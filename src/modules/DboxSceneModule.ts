import * as THREE from 'three'
import type { EngineContext } from '@base/engine-core'
import type { ThreeContext } from '@base/threejs-engine'
import type { SceneDescriptor } from '@base/scene-builder'
import { PhysicsWorld } from '@base/physics'
import { PLAYER_CAPSULE_HALF_HEIGHT } from '@base/player-three'
import { CALIBRATION_POOL_BOUNDS } from '@/calibration/calibrationLayout'
import { SandboxSceneModule } from './SandboxSceneModule'
import { DboxLab } from './dbox/DboxLab'
import type { GameplayLabHost } from './dbox/GameplayLabHost'
import type { ThirdPersonSceneConfig } from './GameplaySceneModule'
import { DboxCharacterEntity } from '@/entities/DboxCharacterEntity'
import { DBOX_ARENA_WALLS, DBOX_ARENA_BOXES, buildArenaWallMeshes } from '@/collision'
import type { ChampionConfig } from '@/champions/ChampionConfig'
import { DOOMFIST_CONFIG } from '@/champions/doomfist'
import type { HudSnapshot } from '@/hud/types'
import { resolvePublicUrl } from '@/utils/resolvePublicUrl'
import { MeshTerrainSampler } from '@/utils/MeshTerrainSampler'


export type DboxSceneModuleOptions = Partial<ThirdPersonSceneConfig> & {
  descriptor?: SceneDescriptor
  /** Override champion config. Defaults to {@link DOOMFIST_CONFIG}. */
  champion?: ChampionConfig
  /** URL to an OW map GLB in public/maps/. Replaces interior hand-authored geometry when present. */
  mapGlbUrl?: string
}

/**
 * Sandbox calibration world + composed {@link DboxLab} (abilities, slam preview, NPC blobs)
 * + {@link DboxCharacterEntity} (wall collision correction layer).
 *
 * Orchestrator only — delegates ability logic to DboxLab, collision to the entity.
 */
export class DboxSceneModule extends SandboxSceneModule implements GameplayLabHost {
  private readonly lab: DboxLab
  private readonly champion: ChampionConfig
  private readonly mapGlbUrl: string | undefined
  private entity: DboxCharacterEntity | null = null
  private arenaMeshes: THREE.Object3D[] = []
  private physicsWorld: PhysicsWorld | null = null
  private mapRoot: THREE.Object3D | null = null

  constructor(options: DboxSceneModuleOptions = {}) {
    const { champion = DOOMFIST_CONFIG, mapGlbUrl, ...rest } = options
    super({
      ...rest,
      characterSpeed: rest.characterSpeed ?? champion.movement.walkSpeed,
      carryImpulseDecayPerSecond: rest.carryImpulseDecayPerSecond ?? champion.movement.carryImpulseDecayPerSecond,
    })
    this.champion = champion
    this.mapGlbUrl = mapGlbUrl
    this.lab = new DboxLab(this, champion)
  }

  /** In OW map mode, skip the calibration grid/platforms/pool/sampler. */
  protected override useSandboxScene(): boolean { return !this.mapGlbUrl }

  getCarryImpulseDecayPerSecond(): number {
    return this.cfg.carryImpulseDecayPerSecond ?? this.champion.movement.carryImpulseDecayPerSecond
  }

  /** Current HUD state for the display overlay. Dummy health until a real health system lands. */
  getHudSnapshot(): HudSnapshot {
    return {
      health: 250,
      healthMax: 250,
      shields: 0,
      shieldsMax: 150,
      abilities: this.lab.getHudAbilities(),
    }
  }

  /** Expose entity for external access (e.g. DboxLab blob collision). */
  getEntity(): DboxCharacterEntity | null {
    return this.entity
  }

  protected override async onMount(container: HTMLElement, context: EngineContext): Promise<void> {
    await super.onMount(container, context)
    const ctx = context as ThreeContext

    // ── OW map GLB ────────────────────────────────────────────────────────
    if (this.mapGlbUrl) {
      try {
        const gltf = await ctx.assets.loadGLTF(resolvePublicUrl(this.mapGlbUrl))
        this.mapRoot = gltf.scene
        ctx.scene.add(this.mapRoot)
        this.physicsWorld = await PhysicsWorld.create()
        // Exclude smd_bone_vis rig-visualization helpers (OWLib exports) — small cylinders
        // scattered throughout the scene that would trap the player if included in the trimesh.
        this.physicsWorld.addStaticMesh(
          this.mapRoot,
          mesh => !/^smd_bone_vis/i.test(mesh.name),
        )
      } catch (err) {
        console.warn('[DboxSceneModule] Map GLB load failed — using hand-authored arena:', err)
      }
    }

    const mapLoaded = this.mapRoot !== null

    // ── Collision geometry ────────────────────────────────────────────────
    // In OW map mode: no analytic boundary planes — Rapier trimesh owns all collision.
    // In sandbox mode: full analytic walls + pillars.
    const activeWalls = mapLoaded ? [] : DBOX_ARENA_WALLS
    const activeBoxes = mapLoaded ? [] : DBOX_ARENA_BOXES

    // ── Map-mode terrain sampler + spawn grounding ────────────────────────
    if (mapLoaded) {
      // Build filtered mesh list — exclude rig-vis helpers and OWLib technical volumes.
      // The following material type prefixes produce non-architectural rendering (effect volumes,
      // spawn zones, zone indicators, water layers) and are hidden while kept for ground sampling:
      //   13A_ = emissive blobs (no texture + full white emissive → warm orange tone-mapped)
      //   9F_  = spawn-room protection volumes (pink/magenta textured volume)
      //   9C_  = KOTH zone indicator / objective overlay
      //   9A_  = effect glow/reflection supplementary layer
      //   B2_  = water / liquid volume
      //   10F_ = particle-effect type
      //   F0_  = decal / overlay effect marker
      //
      // OWLib material names in the exported GLB are formatted as `TypeCode_Hash`, e.g.
      // `13A_81B09AB0F566B1D2` — the type code appears at the START of the name (no colon prefix).
      // The word boundary `\b` matches start-of-string and after any non-word char (dot, colon,
      // space) without matching a code embedded inside a longer hex hash like `AB13A_`.
      const OWLIB_TECHNICAL_MAT = /\b(13A|9F|9C|9A|B2|10F|F0)_/
      const terrainMeshes: THREE.Mesh[] = []
      let hiddenTechCount = 0
      this.mapRoot!.traverse(child => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        if (/^smd_bone_vis/i.test(mesh.name)) return
        const geo = mesh.geometry
        const triCount = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const matName = (mat as any)?.name ?? ''
        // Hide tiny data-node quads (spawn markers, triggers ≤8 tris) and OWLib
        // technical volume meshes (emissive effect/spawn/decal material types).
        const isTechMat = OWLIB_TECHNICAL_MAT.test(matName)
        if (triCount <= 8 || isTechMat) {
          mesh.visible = false
          if (isTechMat) hiddenTechCount++
        }
        terrainMeshes.push(mesh)
      })
      console.debug(`[DboxSceneModule] OWLib mesh filter: ${hiddenTechCount} technical-material meshes hidden`)

      // ── Terrain sampler ──────────────────────────────────────────────────
      // ── Probe strategy: max(characterY + 1.0, 1.0) ──────────────────────
      // A purely fixed probe (probeFromY=1.0) worked for the ground floor but missed any
      // surface above Y=1.0. A purely character-relative probe (player.y − offset) breaks
      // the self-correction guarantee: if the player ends up BELOW the floor the probe also
      // goes below it, misses it, and the player stays stuck.
      //
      // max(characterY + 1.0, 1.0) gives both:
      //   • +1.0 above character → probe always starts above character centre; elevated floors
      //     are found because the probe tracks the player up when abilities carry them high.
      //   • Hard floor at Y=1.0 → the probe NEVER goes below 1.0. At spawn time character.y≈0
      //     so probe=1.0 exactly (identical to the confirmed working baseline). When the player
      //     somehow goes below the floor the probe clamps to 1.0, finds −0.97 from above, and
      //     self-corrects within one tick.
      //   • Rooftop (Y≈81.5): only reachable when character.y > 80.5 — far outside normal range.
      //   • Ceilings: Three.js FrontSide raycast only hits up-facing faces; ceiling geometry
      //     (front face pointing DOWN) is missed regardless of probe height.
      const character = this.getCharacter()
      const controller = this.getPlayerController()
      this.setSampler(new MeshTerrainSampler(terrainMeshes, null, () => Math.max(character.position.y + 1.0, 1.0)))

      const samplerHitX = 30, samplerHitZ = -15  // east-wing interior (confirmed)
      const floorY   = this.sampleTerrainSurfaceY(samplerHitX, samplerHitZ)
      const spawnY   = floorY + PLAYER_CAPSULE_HALF_HEIGHT
      character.position.set(samplerHitX, spawnY, samplerHitZ)
      controller.syncPosition(samplerHitX, spawnY, samplerHitZ)
    }

    // ── Character entity (collision correction layer) ────────────────────
    this.entity = new DboxCharacterEntity(
      () => this.getPlayerController(),
      () => this.getCharacter(),
      this.champion.collision,
    )
    this.entity.setCollisionGeometry(activeWalls, activeBoxes)
    if (this.physicsWorld) this.entity.setPhysicsWorld(this.physicsWorld)

    // ── Arena wall visual meshes (sandbox only) ───────────────────────────
    this.arenaMeshes = mapLoaded ? [] : buildArenaWallMeshes(false)
    for (const m of this.arenaMeshes) ctx.scene.add(m)

    this.lab.mount(container, context.eventBus, ctx, { spawnBlobs: !mapLoaded })
    this.lab.setWallGeometry(activeWalls, activeBoxes)
  }

  protected override async onUnmount(): Promise<void> {
    this.lab.unmount()
    for (const m of this.arenaMeshes) m.parent?.remove(m)
    this.arenaMeshes = []
    if (this.mapRoot) {
      this.mapRoot.parent?.remove(this.mapRoot)
      this.mapRoot = null
    }
    this.physicsWorld?.dispose()
    this.physicsWorld = null
    this.entity = null
    await super.onUnmount()
  }

  protected override onBeforeGameplayTick(_simDelta: number, _ctx: ThreeContext): void {
    this.lab.beforeGameplayTick()
  }

  protected override onAfterGameplayTick(simDelta: number, ctx: ThreeContext): void {
    this.lab.afterGameplayTick(simDelta, ctx)

    // Entity resolves wall collision AFTER abilities have applied carry velocity.
    // Carry-based resolve handles punch/slam wall interaction (slide + stop).
    this.entity?.resolveCollision()
    // Walking resolve handles normal movement into walls.
    this.entity?.resolveWalkingCollision()
  }

  protected override handleJumpPressedEarly(): boolean {
    return this.lab.handleJumpPressedEarly()
  }
}

/** Pool bounds — alias of {@link CALIBRATION_POOL_BOUNDS} for legacy imports. */
export const DBOX_POOL_BOUNDS = CALIBRATION_POOL_BOUNDS
