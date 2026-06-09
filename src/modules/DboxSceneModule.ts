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
import { extractHealthPackSlots } from '@/items/HealthPackExtractor'
import { HealthPackManager } from '@/items/HealthPackManager'


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
  private debugMarkerMeshes: THREE.Mesh[] = []
  private healthPackManager: HealthPackManager | null = null
  /** Incremented each onMount() — drives health pack rotation index. */
  private spawnCount = 0

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

      // Pick spawn: random from spawnPoints list if provided, fallback to spawnX/Z.
      let spawnX = desc.spawnX
      let spawnZ = desc.spawnZ
      if (desc.spawnPoints && desc.spawnPoints.length > 0) {
        const pt = desc.spawnPoints[Math.floor(Math.random() * desc.spawnPoints.length)]
        spawnX = pt[0]
        spawnZ = pt[1]
      }
      const floorY = this.sampleTerrainSurfaceY(spawnX, spawnZ)
      const spawnY = floorY + PLAYER_CAPSULE_HALF_HEIGHT
      character.position.set(spawnX, spawnY, spawnZ)
      controller.syncPosition(spawnX, spawnY, spawnZ)

      // ── Display overrides (opacity / visibility per zone) ─────────────────
      // Second pass — runs on ALL meshes including physics-excluded ones, so
      // background geometry hidden from Rapier can also be hidden visually.
      if (desc.meshDisplayOverrides?.length) {
        let overrideCount = 0
        this.mapRoot!.traverse(child => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          for (const override of desc.meshDisplayOverrides!) {
            if (!override.pattern.test(mesh.name)) continue
            if (override.opacity <= 0) {
              mesh.visible = false
            } else {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
              for (const m of mats) {
                const mat = m as THREE.MeshStandardMaterial
                mat.transparent = override.opacity < 1
                mat.opacity = override.opacity
                mat.needsUpdate = true
              }
            }
            overrideCount++
            break
          }
        })
        console.debug(`[DboxSceneModule] display overrides: ${overrideCount} meshes affected`)
      }

      // Dev: render green spheres at every ≤8-tri OWLib marker mesh.
      if (desc.debugMarkers) this.renderDebugMarkers(ctx.scene, this.mapRoot!)

      // ── Health pack substructure ──────────────────────────────────────────
      if (desc.healthPacks) {
        // updateWorldMatrix ensures getWorldPosition returns correct values
        // even before the first render frame.
        this.mapRoot!.updateWorldMatrix(true, true)
        const slots = extractHealthPackSlots(this.mapRoot!, desc.healthPacks.slots)
        this.healthPackManager = new HealthPackManager(slots, desc.healthPacks.rotations ?? null)
        this.healthPackManager.mount(ctx.scene, this.spawnCount)
      }
    }

    this.spawnCount++

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
    for (const m of this.debugMarkerMeshes) m.parent?.remove(m)
    this.debugMarkerMeshes = []
    this.healthPackManager?.unmount()
    this.healthPackManager = null
    if (this.mapRoot) {
      this.mapRoot.parent?.remove(this.mapRoot)
      this.mapRoot = null
    }
    this.physicsWorld?.dispose()
    this.physicsWorld = null
    this.entity = null
    await super.onUnmount()
  }

  /**
   * Dev tool: place a bright sphere at every mesh node with ≤8 triangles.
   * These are OWLib entity marker quads — health packs, spawn volumes, triggers.
   * Uses Three.js getWorldPosition so parent rotations are handled correctly.
   * Logs "(marker) MeshName  x  y  z" to console.debug for coordinate capture.
   */
  private renderDebugMarkers(scene: THREE.Scene, root: THREE.Object3D): void {
    const geo = new THREE.SphereGeometry(0.3, 6, 6)
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff66 })
    root.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const g = mesh.geometry
      const tris = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
      if (tris === 0 || tris > 8) return
      const pos = new THREE.Vector3()
      mesh.getWorldPosition(pos)
      const marker = new THREE.Mesh(geo, mat)
      marker.position.copy(pos)
      scene.add(marker)
      this.debugMarkerMeshes.push(marker)
      // Include parent entity node name — OWLib entity nodes are named "Entity <HexId>.<instance>"
      const entityNode = mesh.parent?.name ?? 'unknown'
      console.debug(
        `[marker] entity=${entityNode.padEnd(24)} mesh=${mesh.name.padEnd(40)} x=${pos.x.toFixed(2).padStart(7)}  y=${pos.y.toFixed(2).padStart(7)}  z=${pos.z.toFixed(2).padStart(7)}`,
      )
    })
    console.debug(`[marker] total: ${this.debugMarkerMeshes.length} marker spheres rendered`)
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

    // Health pack pickup detection + cooldown advance.
    // hpGain feeds the health system once it lands; log for now.
    const hpGain = this.healthPackManager?.tick(this.getCharacter().position, simDelta) ?? 0
    if (hpGain > 0) console.debug(`[DboxSceneModule] +${hpGain} HP from health pack`)
  }

  protected override handleJumpPressedEarly(): boolean {
    return this.lab.handleJumpPressedEarly()
  }
}

/** Pool bounds — alias of {@link CALIBRATION_POOL_BOUNDS} for legacy imports. */
export const DBOX_POOL_BOUNDS = CALIBRATION_POOL_BOUNDS
