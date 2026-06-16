import * as THREE from 'three'
import type { PlayerController } from '@base/player-three'
import { PLAYER_CAPSULE_HALF_HEIGHT } from '@base/player-three'
import type { ChampionCollisionConfig } from '@/champions/ChampionConfig'
import type { WallPlane, WallBox } from '../collision'
import { resolveCircleVsPlane, resolveCircleVsBox, computeSlideVelocity } from '../collision'
import type { PhysicsWorld } from '@base/physics'

/**
 * Character entity for the Doomfist champion — correction layer over PlayerController.
 *
 * Responsibilities:
 * - Owns wall collision geometry references
 * - After each gameplay tick, checks player position against walls
 * - Corrects position (push-out) and carry velocity (slide) when penetrating
 *
 * Does NOT own abilities (DboxLab handles those and injects carry velocity directly).
 * Future: abilities migrate into this entity.
 */
export class DboxCharacterEntity {
  private walls: WallPlane[] = []
  private boxes: WallBox[] = []
  private readonly headOnAngleRad: number
  private physicsWorld: PhysicsWorld | null = null

  /** EX-1 diagnostics — last walking-resolve Rapier step lift / wall push depth
   *  (metres), reset each `resolveWalkingCollision()`.  Read by the `?navdebug`
   *  logger to correlate stair pops with the lift that caused them.  Zero overhead;
   *  feeds the EX-2 step-smoothing fix. */
  lastStepLiftY = 0
  lastWallPushDepth = 0

  /** Minimum Rapier penetration depth for an XZ wall push to fire.
   *  Contacts shallower than this are stair-riser grazes — skip them so the
   *  terrain sampler can snap the player down on descent without fighting the push. */
  private static readonly RAPIER_WALL_MIN_DEPTH = 0.05

  /** Lift the feet collision sphere this far above the grounded feet so the Rapier
   *  probe ignores floor-tile relief / seams (the top-down `MeshTerrainSampler`
   *  already owns floor height). Without it the feet sphere bottom sits AT floor
   *  level and catches every tile edge while walking flat ground → micro step-lifts
   *  ("stumble") and XZ pushes ("stuck"). Keep below real step height (~0.15 m) so
   *  genuine steps are still caught. Tunable live via ?navdebug (logs lift/push).
   *  EX-2 floor-nav smoothing, 2026-06-14. */
  private static readonly FOOT_PROBE_CLEARANCE = 0.12

  /** EX-2.1 anti-tunnelling. End-of-tick resolved position, fed to the next
   *  tick's swept wall cast so a fast carry move (rocket punch ≈ 152 m/s ≈
   *  2.5 m/tick vs radius 0.4) can't pass through a thin wall between the
   *  overlap probes that only test the end position. */
  private lastPosition: THREE.Vector3 | null = null
  /** Sweep only when a tick's move exceeds this fraction of playerRadius —
   *  walking (≤0.09 m/tick) never pays the extra cast; carry abilities do. */
  private static readonly SWEEP_MIN_MOVE_FRACTION = 0.5
  /** Back the clamped contact off the wall by this skin (m) so the follow-up
   *  overlap probe doesn't immediately re-fire on the same surface. */
  private static readonly SWEEP_BACKOFF = 0.02

  constructor(
    private readonly getController: () => PlayerController,
    private readonly getCharacter: () => THREE.Object3D,
    private readonly cfg: ChampionCollisionConfig,
  ) {
    this.headOnAngleRad = (cfg.headOnAngleDeg * Math.PI) / 180
  }

  /** Register arena collision geometry. */
  setCollisionGeometry(walls: WallPlane[], boxes: WallBox[]): void {
    this.walls = walls
    this.boxes = boxes
  }

  /** Wire in Rapier physics for map-interior trimesh collision. */
  setPhysicsWorld(world: PhysicsWorld): void {
    this.physicsWorld = world
  }

  /** Expose walls for blob NPC collision in DboxLab. */
  getWalls(): WallPlane[] { return this.walls }
  getBoxes(): WallBox[] { return this.boxes }

  /**
   * Post-tick collision correction.
   * Call from `onAfterGameplayTick` — after PlayerController has moved the character.
   */
  resolveCollision(): void {
    const controller = this.getController()
    const character = this.getCharacter()
    const carry = controller.getPlanarCarryVelocity()

    const carrySpeed = Math.hypot(carry.x, carry.z)
    const hasCarry = carrySpeed > this.cfg.carryThreshold

    const px = character.position.x
    const pz = character.position.z
    let cx = px
    let cy = character.position.y
    let cz = pz
    let corrected = false
    let slideNx = 0
    let slideNz = 0

    // EX-2.1 anti-tunnelling swept resolve — runs before the overlap probes.
    // A carry move faster than ~2×radius/tick clips fully through a thin wall
    // before `spherePenetration` (overlap-only) ever sees it. When this tick's
    // move is large enough to risk that, sweep last→current and clamp at the
    // first wall contact. Gated by move distance, so walking never pays the cast.
    if (this.physicsWorld && this.lastPosition) {
      const moveX = cx - this.lastPosition.x
      const moveY = cy - this.lastPosition.y
      const moveZ = cz - this.lastPosition.z
      const moveDist = Math.hypot(moveX, moveY, moveZ)
      if (moveDist > this.cfg.playerRadius * DboxCharacterEntity.SWEEP_MIN_MOVE_FRACTION) {
        const swept = this.physicsWorld.shapeCastSphere(
          this.lastPosition,
          new THREE.Vector3(cx, cy, cz),
          this.cfg.playerRadius,
        )
        // Wall only — skip floor/ceiling hits (|normal.y| ≥ 0.7) so fast vertical
        // travel (slam) and ground-skim punches aren't clamped by the sweep.
        if (swept && Math.abs(swept.normal.y) < 0.7) {
          const back = DboxCharacterEntity.SWEEP_BACKOFF
          cx = this.lastPosition.x + moveX * swept.toi + swept.normal.x * back
          cy = this.lastPosition.y + moveY * swept.toi + swept.normal.y * back
          cz = this.lastPosition.z + moveZ * swept.toi + swept.normal.z * back
          slideNx = swept.normal.x
          slideNz = swept.normal.z
          corrected = true
        }
      }
    }

    for (const wall of this.walls) {
      const hit = resolveCircleVsPlane(cx, cz, this.cfg.playerRadius, wall)
      if (hit) {
        cx = hit.x
        cz = hit.z
        slideNx = hit.nx
        slideNz = hit.nz
        corrected = true
      }
    }

    for (const box of this.boxes) {
      const hit = resolveCircleVsBox(cx, cz, this.cfg.playerRadius, box)
      if (hit) {
        cx = hit.x
        cz = hit.z
        slideNx = hit.nx
        slideNz = hit.nz
        corrected = true
      }
    }

    // Rapier trimesh — dual-sphere probe (feet + head) catches thin exterior walls
    // that a single centre-sphere misses. Ignore floor hits (|normalY| >= 0.7).
    if (this.physicsWorld) {
      const feetCenter = new THREE.Vector3(cx, cy - PLAYER_CAPSULE_HALF_HEIGHT + this.cfg.playerRadius + DboxCharacterEntity.FOOT_PROBE_CLEARANCE, cz)
      const headCenter = new THREE.Vector3(cx, cy + PLAYER_CAPSULE_HALF_HEIGHT - this.cfg.playerRadius, cz)

      const hitFeet = this.physicsWorld.spherePenetration(feetCenter, this.cfg.playerRadius)
      const hitHead = this.physicsWorld.spherePenetration(headCenter, this.cfg.playerRadius)

      // Pick the deeper penetration from either probe.
      let phit = null as typeof hitFeet
      if (hitFeet && Math.abs(hitFeet.normal.y) < 0.7) phit = hitFeet
      if (hitHead && Math.abs(hitHead.normal.y) < 0.7 && (!phit || hitHead.depth > phit.depth)) phit = hitHead

      if (phit) {
        if (phit.normal.y > 0.3) {
          // Step/ramp — snap Y up instead of blocking XZ.
          cy += phit.depth * phit.normal.y
          corrected = true
        } else if (phit.depth > DboxCharacterEntity.RAPIER_WALL_MIN_DEPTH) {
          // Significant wall hit — skip shallow grazes (stair-riser depth < RAPIER_WALL_MIN_DEPTH)
          // so the terrain sampler handles stair descent without fighting the XZ push.
          cx += phit.normal.x * phit.depth
          cz += phit.normal.z * phit.depth
          slideNx = phit.normal.x
          slideNz = phit.normal.z
          corrected = true
        }
      }
    }

    if (!corrected) return

    character.position.x = cx
    character.position.y = cy
    character.position.z = cz
    controller.syncPosition(cx, cy, cz)

    if (hasCarry && (slideNx !== 0 || slideNz !== 0)) {
      const slide = computeSlideVelocity(
        carry.x,
        carry.z,
        slideNx,
        slideNz,
        this.cfg.slideFriction,
        this.headOnAngleRad,
      )
      controller.setPlanarCarryVelocity(slide.vx, slide.vz)
    }
  }

  /**
   * Walking collision — simpler than carry resolve.
   * Prevents walking through walls even without carry velocity.
   */
  resolveWalkingCollision(): void {
    const character = this.getCharacter()
    const controller = this.getController()
    let cx = character.position.x
    let cy = character.position.y
    let cz = character.position.z
    let corrected = false
    this.lastStepLiftY = 0
    this.lastWallPushDepth = 0

    for (const wall of this.walls) {
      const hit = resolveCircleVsPlane(cx, cz, this.cfg.playerRadius, wall)
      if (hit) {
        cx = hit.x
        cz = hit.z
        corrected = true
      }
    }

    for (const box of this.boxes) {
      const hit = resolveCircleVsBox(cx, cz, this.cfg.playerRadius, box)
      if (hit) {
        cx = hit.x
        cz = hit.z
        corrected = true
      }
    }

    // Rapier trimesh — dual-sphere (feet + head) + step-climb for walking collision.
    if (this.physicsWorld) {
      const feetCenter = new THREE.Vector3(cx, cy - PLAYER_CAPSULE_HALF_HEIGHT + this.cfg.playerRadius + DboxCharacterEntity.FOOT_PROBE_CLEARANCE, cz)
      const headCenter = new THREE.Vector3(cx, cy + PLAYER_CAPSULE_HALF_HEIGHT - this.cfg.playerRadius, cz)

      const hitFeet = this.physicsWorld.spherePenetration(feetCenter, this.cfg.playerRadius)
      const hitHead = this.physicsWorld.spherePenetration(headCenter, this.cfg.playerRadius)

      let phit = null as typeof hitFeet
      if (hitFeet && Math.abs(hitFeet.normal.y) < 0.7) phit = hitFeet
      if (hitHead && Math.abs(hitHead.normal.y) < 0.7 && (!phit || hitHead.depth > phit.depth)) phit = hitHead

      if (phit) {
        if (phit.normal.y > 0.3) {
          // Full depth lift (not depth * normalY) for guaranteed step clearance.
          // depth * normalY undershot on steps with shallow normals (e.g. 0.35 → 35% lift).
          cy += phit.depth
          this.lastStepLiftY = phit.depth
          corrected = true
        } else if (phit.depth > DboxCharacterEntity.RAPIER_WALL_MIN_DEPTH) {
          cx += phit.normal.x * phit.depth
          cz += phit.normal.z * phit.depth
          this.lastWallPushDepth = phit.depth
          corrected = true
        }
      }
    }

    if (corrected) {
      character.position.x = cx
      character.position.y = cy
      character.position.z = cz
      controller.syncPosition(cx, cy, cz)
    }

    // Record the final resolved position for next tick's anti-tunnel sweep
    // (EX-2.1). resolveWalkingCollision runs last in onAfterGameplayTick, so
    // character.position here is the authoritative end-of-tick position.
    if (!this.lastPosition) this.lastPosition = new THREE.Vector3()
    this.lastPosition.set(character.position.x, character.position.y, character.position.z)
  }
}
