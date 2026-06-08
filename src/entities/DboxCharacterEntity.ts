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
    let cz = pz
    let corrected = false
    let slideNx = 0
    let slideNz = 0

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

    // Rapier trimesh — map interior geometry (walls, ramps, obstacles).
    // Ignore floor hits (|normalY| >= 0.7) — terrain sampler owns ground contact.
    if (this.physicsWorld) {
      const center = new THREE.Vector3(cx, character.position.y + PLAYER_CAPSULE_HALF_HEIGHT, cz)
      const phit = this.physicsWorld.spherePenetration(center, this.cfg.playerRadius)
      if (phit && Math.abs(phit.normal.y) < 0.7) {
        cx += phit.normal.x * phit.depth
        cz += phit.normal.z * phit.depth
        slideNx = phit.normal.x
        slideNz = phit.normal.z
        corrected = true
      }
    }

    if (!corrected) return

    character.position.x = cx
    character.position.z = cz
    controller.syncPosition(cx, character.position.y, cz)

    if (hasCarry) {
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
    let cz = character.position.z
    let corrected = false

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

    // Rapier trimesh — walking collision against map interior geometry.
    if (this.physicsWorld) {
      const center = new THREE.Vector3(cx, character.position.y + PLAYER_CAPSULE_HALF_HEIGHT, cz)
      const phit = this.physicsWorld.spherePenetration(center, this.cfg.playerRadius)
      if (phit && Math.abs(phit.normal.y) < 0.7) {
        cx += phit.normal.x * phit.depth
        cz += phit.normal.z * phit.depth
        corrected = true
      }
    }

    if (corrected) {
      character.position.x = cx
      character.position.z = cz
      controller.syncPosition(cx, character.position.y, cz)
    }
  }
}
