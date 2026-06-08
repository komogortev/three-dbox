import * as THREE from 'three'
import type { EngineContext } from '@base/engine-core'
import type { ThreeContext } from '@base/threejs-engine'
import type { SceneDescriptor } from '@base/scene-builder'
import { PhysicsWorld } from '@base/physics'
import { PLAYER_CAPSULE_HALF_HEIGHT } from '@base/player-three'
import { CALIBRATION_POOL_BOUNDS } from '@/calibration/calibrationLayout'
import { SandboxSceneModule } from './SandboxSceneModule'
import { DoomfistLab } from './dbox/DboxLab'
import type { GameplayLabHost } from './dbox/GameplayLabHost'
import type { IAbilityLab } from './dbox/IAbilityLab'
import type { MapDescriptor } from '@/maps/MapDescriptor'
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
  /** OW map descriptor — replaces hand-authored arena geometry when present. */
  map?: MapDescriptor
}

/**
 * Sandbox calibration world + composed {@link DboxLab} (abilities, slam preview, NPC blobs)
 * + {@link DboxCharacterEntity} (wall collision correction layer).
 *
 * Orchestrator only — delegates ability logic to DboxLab, collision to the entity.
 */
export class DboxSceneModule extends SandboxSceneModule implements GameplayLabHost {
  private readonly lab: IAbilityLab
  private readonly champion: ChampionConfig
  private readonly map: MapDescriptor | undefined
  private entity: DboxCharacterEntity | null = null
  private arenaMeshes: THREE.Object3D[] = []
  private physicsWorld: PhysicsWorld | null = null
  private mapRoot: THREE.Object3D | null = null

  constructor(options: DboxSceneModuleOptions = {}) {
    const { champion = DOOMFIST_CONFIG, map, ...rest } = options
    super({
      ...rest,
      characterSpeed: rest.characterSpeed ?? champion.movement.walkSpeed,
      carryImpulseDecayPerSecond: rest.carryImpulseDecayPerSecond ?? champion.movement.carryImpulseDecayPerSecond,
    })
    this.champion = champion
    this.map = map
    this.lab = new DoomfistLab(this, champion)
  }

  /** In OW map mode, skip the calibration grid/platforms/pool/sampler. */
  protected override useSandboxScene(): boolean { return !this.map }

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
    if (this.map) {
      try {
        const gltf = await ctx.assets.loadGLTF(resolvePublicUrl(this.map.glbUrl))
        this.mapRoot = gltf.scene
        ctx.scene.add(this.mapRoot)
        this.physicsWorld = await PhysicsWorld.create()
        this.physicsWorld.addStaticMesh(this.mapRoot, this.map.physicsFilter)
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
      const desc = this.map!
      const terrainMeshes: THREE.Mesh[] = []
      let hiddenTechCount = 0
      this.mapRoot!.traverse(child => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        // Apply physics filter — same meshes excluded from Rapier are excluded from terrain.
        if (desc.physicsFilter && !desc.physicsFilter(mesh)) return
        const geo = mesh.geometry
        const triCount = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const matName = (mat as any)?.name ?? ''
        // Hide ≤8-tri data-node quads (spawn markers / triggers) and OWLib technical
        // material volumes — kept in terrain for floor-Y sampling, just not rendered.
        const isTechMat = desc.owlibTechMat ? desc.owlibTechMat.test(matName) : false
        if (triCount <= 8 || isTechMat) {
          mesh.visible = false
          if (isTechMat) hiddenTechCount++
        }
        terrainMeshes.push(mesh)
      })
      console.debug(`[DboxSceneModule] OWLib mesh filter: ${hiddenTechCount} technical-material meshes hidden`)

      // Probe strategy: max(characterY + 1.0, 1.0) — tracks player elevation for
      // multi-level geometry while clamping to 1.0 for spawn self-correction.
      const character = this.getCharacter()
      const controller = this.getPlayerController()
      this.setSampler(new MeshTerrainSampler(terrainMeshes, null, () => Math.max(character.position.y + 1.0, 1.0)))

      const floorY = this.sampleTerrainSurfaceY(desc.spawnX, desc.spawnZ)
      const spawnY = floorY + PLAYER_CAPSULE_HALF_HEIGHT
      character.position.set(desc.spawnX, spawnY, desc.spawnZ)
      controller.syncPosition(desc.spawnX, spawnY, desc.spawnZ)
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
