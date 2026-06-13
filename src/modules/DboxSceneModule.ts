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
import { extractEntityNodes } from '@/maps/entityScan'
import { extractHealthPackSlots } from '@/items/HealthPackExtractor'
import { HealthPackManager } from '@/items/HealthPackManager'
import { RoundManager } from '@/round/RoundManager'
import type { RoundSnapshot } from '@/round/types'
import { hasQueryFlag, queryNumber, CountingSampler, PerfOverlay } from '@/debug/diagnostics'


export type DboxSceneModuleOptions = Partial<ThirdPersonSceneConfig> & {
  descriptor?: SceneDescriptor
  /** Override champion config. Defaults to {@link DOOMFIST_CONFIG}. */
  champion?: ChampionConfig
  /** OW map descriptor — replaces hand-authored arena geometry when present. */
  map?: MapDescriptor
}

/**
 * Health-pack rotation counter (assessment fix A2).  Module scope on purpose:
 * DboxView constructs a fresh DboxSceneModule on every navigation — including
 * the Play Again menu-detour — so an instance field never exceeds 0 at mount
 * time.  Module scope survives remounts within the SPA session, which is the
 * "each visit cycles the layout" intent.  Global across arenas; key by arena
 * id when map #2 lands.
 */
let packRotationCounter = 0

/**
 * Sandbox calibration world + composed {@link DboxLab} (abilities, slam preview, NPC blobs)
 * + {@link DboxCharacterEntity} (wall collision correction layer).
 *
 * Orchestrator only — delegates ability logic to DboxLab, collision to the entity.
 */
export class DboxSceneModule extends SandboxSceneModule implements GameplayLabHost {
  private readonly lab: IAbilityLab
  private readonly champion: ChampionConfig
  /** Cleared at mount when the map GLB fails to load → sandbox fallback (A3). */
  private map: MapDescriptor | undefined
  private entity: DboxCharacterEntity | null = null
  private arenaMeshes: THREE.Object3D[] = []
  private physicsWorld: PhysicsWorld | null = null
  private mapRoot: THREE.Object3D | null = null
  private debugMarkerMeshes: THREE.Mesh[] = []
  private healthPackManager: HealthPackManager | null = null
  private readonly roundManager = new RoundManager()

  // ── EX-1 diagnostics (flag-gated; no-op without ?perf / ?navdebug) ──────
  private readonly perfEnabled = hasQueryFlag('perf')
  private readonly navDebugEnabled = hasQueryFlag('navdebug')
  private perfOverlay: PerfOverlay | null = null
  private countingSampler: CountingSampler | null = null
  private unregisterPerf: (() => void) | null = null
  /** The terrain probe-origin callback, captured so ?navdebug can read it. */
  private navProbeFromY: (() => number) | null = null
  private navLogAccum = 0
  private navLastY = 0

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
    const ctx = context as ThreeContext

    // ── OW map GLB + physics init — BEFORE super.onMount() (A3) ───────────
    // super consults useSandboxScene() to decide whether to build calibration
    // terrain/sampler/geometry.  Loading first lets a failure clear this.map so
    // the fallback is a genuinely playable sandbox arena, not a void.  Scene
    // insertion waits until after super (scene graph not touched here).
    let mapScene: THREE.Object3D | null = null
    if (this.map) {
      try {
        const gltf = await ctx.assets.loadGLTF(resolvePublicUrl(this.map.glbUrl))
        mapScene = gltf.scene
        this.physicsWorld = await PhysicsWorld.create()
      } catch (err) {
        console.error('[DboxSceneModule] Map load failed — falling back to sandbox arena:', err)
        this.map = undefined
        mapScene = null
        this.physicsWorld?.dispose()
        this.physicsWorld = null
      }
    }

    await super.onMount(container, context)

    // ── Renderer quick wins (EX-1.2) — ships unconditionally ──────────────
    // ThreeModule sets an UNCAPPED setPixelRatio(devicePixelRatio); on hi-DPI
    // displays that is the largest single perf lever (fragment work scales with
    // ratio²).  Cap at 2; `?pixelratio=N` overrides so the owner can A/B uncapped.
    // setPixelRatio re-applies the drawing-buffer size internally, so calling it
    // post-mount is safe.  toneMapping/shadowMap left at engine defaults here and
    // logged for the EX-1 audit — tuning them is EX-3's job (avoid visual drift now).
    const beforeRatio = ctx.renderer.getPixelRatio()
    const cappedRatio = queryNumber('pixelratio') ?? Math.min(window.devicePixelRatio || 1, 2)
    ctx.renderer.setPixelRatio(cappedRatio)
    console.debug(
      `[dbox/perf] pixelRatio ${beforeRatio} → ${cappedRatio} (devicePixelRatio=${window.devicePixelRatio}); ` +
      `toneMapping=${ctx.renderer.toneMapping} exposure=${ctx.renderer.toneMappingExposure}; ` +
      `shadowMap.enabled=${ctx.renderer.shadowMap.enabled} type=${ctx.renderer.shadowMap.type}`,
    )

    if (this.map && mapScene && this.physicsWorld) {
      this.mapRoot = mapScene
      ctx.scene.add(this.mapRoot)
      this.physicsWorld.addStaticMesh(this.mapRoot, this.map.physicsFilter)
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
      const probeFromY = () => Math.max(character.position.y + 1.0, 1.0)
      this.navProbeFromY = probeFromY
      const baseSampler = new MeshTerrainSampler(terrainMeshes, null, probeFromY)
      // ?perf wraps the sampler to count raycasts/frame; production uses it raw.
      this.countingSampler = this.perfEnabled ? new CountingSampler(baseSampler) : null
      this.setSampler(this.countingSampler ?? baseSampler)

      // Pick spawn: random from spawnPoints list if provided, fallback to spawnX/Z.
      // (SP-2 replaces the random pick with a round-robin cursor + respawn path.)
      let spawnX = desc.spawnX
      let spawnZ = desc.spawnZ
      if (desc.spawnPoints && desc.spawnPoints.length > 0) {
        const pt = desc.spawnPoints[Math.floor(Math.random() * desc.spawnPoints.length)]
        spawnX = pt.x
        spawnZ = pt.z
        console.debug(`[DboxSceneModule] spawn at '${pt.label}' (${pt.x.toFixed(1)}, ${pt.z.toFixed(1)})`)
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
        this.healthPackManager.mount(ctx.scene, packRotationCounter)
        packRotationCounter++
      }
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

    // ── Perf monitor (EX-1.1) — 1 Hz renderer.info + frame-time overlay ───
    if (this.perfEnabled) this.setupPerfMonitor(container, ctx)

    // Start the pre-round countdown after the scene is fully mounted.
    this.roundManager.start()
  }

  /**
   * `?perf` — registers a per-frame system that aggregates frame time and snapshots
   * `renderer.info` (draw calls / triangles / programs / GPU memory) + sampler
   * raycasts once per second, into both an on-screen overlay and `console.debug`.
   * The system runs before render, so `renderer.info` reflects the prior frame —
   * a stable per-frame figure.  Unregistered + overlay disposed in onUnmount.
   */
  private setupPerfMonitor(container: HTMLElement, ctx: ThreeContext): void {
    this.perfOverlay = new PerfOverlay(container)
    // Diagnosis handle (dev-only, ?perf) — lets the live preview session read
    // renderer.info and force one correctly-sized frame even when an unfocused
    // headless tab throttles RAF. Cleared in onUnmount to avoid retaining GPU refs.
    ;(window as unknown as Record<string, unknown>).__dboxPerf = {
      renderer: ctx.renderer,
      scene: ctx.scene,
      camera: ctx.camera,
      getSamplerCount: () => this.countingSampler?.takeCount() ?? 0,
    }
    let acc = 0
    let frames = 0
    let maxFrame = 0
    let last = performance.now()
    this.unregisterPerf = ctx.registerSystem('dbox-perf', () => {
      const now = performance.now()
      const ft = now - last
      last = now
      acc += ft
      frames++
      if (ft > maxFrame) maxFrame = ft
      if (acc < 1000) return
      const info = ctx.renderer.info
      const fps = (frames * 1000) / acc
      const avg = acc / frames
      const samples = this.countingSampler?.takeCount() ?? 0
      const text =
        `dbox perf  dpr ${(window.devicePixelRatio || 1).toFixed(2)} → cap ${ctx.renderer.getPixelRatio()}\n` +
        `fps ${fps.toFixed(0)}   frame avg ${avg.toFixed(1)}ms  max ${maxFrame.toFixed(1)}ms\n` +
        `draws ${info.render.calls}   tris ${(info.render.triangles / 1000).toFixed(0)}k   progs ${info.programs?.length ?? '?'}\n` +
        `geo ${info.memory.geometries}   tex ${info.memory.textures}\n` +
        `sampler ${samples}/s  (${(samples / Math.max(frames, 1)).toFixed(1)}/frame)`
      this.perfOverlay?.set(text)
      console.debug(`[dbox/perf] ${text.replace(/\n/g, ' | ')}`)
      acc = 0
      frames = 0
      maxFrame = 0
    })
  }

  protected override async onUnmount(): Promise<void> {
    this.unregisterPerf?.()
    this.unregisterPerf = null
    this.perfOverlay?.dispose()
    this.perfOverlay = null
    this.countingSampler = null
    this.navProbeFromY = null
    if ((window as unknown as Record<string, unknown>).__dboxPerf) {
      delete (window as unknown as Record<string, unknown>).__dboxPerf
    }
    this.roundManager.reset()
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
   * Dev tool, two passes:
   *   1. Green sphere at every mesh node with ≤8 triangles — OWLib entity marker
   *      quads (health packs, item markers, triggers).  Logged as `[marker]`.
   *   2. With {@link MapDescriptor#debugEntityTypes}: magenta sphere at every
   *      OWLib entity node of those types — catches pure-EMPTY entities (e.g.
   *      0345 spawn volumes) that carry no mesh and are invisible to pass 1.
   *      Logged as `[entity]`.
   * Uses world positions so parent rotations are handled correctly.
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
      // Parent entity node name — convention "00000000<TypeHex4><Instance3>" (see entityScan.ts).
      const entityNode = mesh.parent?.name ?? 'unknown'
      console.debug(
        `[marker] entity=${entityNode.padEnd(24)} mesh=${mesh.name.padEnd(40)} x=${pos.x.toFixed(2).padStart(7)}  y=${pos.y.toFixed(2).padStart(7)}  z=${pos.z.toFixed(2).padStart(7)}`,
      )
    })
    console.debug(`[marker] total: ${this.debugMarkerMeshes.length} marker spheres rendered`)

    const entityTypes = this.map?.debugEntityTypes
    if (entityTypes?.length) {
      root.updateWorldMatrix(true, true)
      const nodes = extractEntityNodes(root, entityTypes)
      const eGeo = new THREE.SphereGeometry(0.4, 8, 8)
      const eMat = new THREE.MeshBasicMaterial({ color: 0xff00ff })
      for (const n of nodes) {
        const marker = new THREE.Mesh(eGeo, eMat)
        marker.position.copy(n.position)
        scene.add(marker)
        this.debugMarkerMeshes.push(marker)
        console.debug(
          `[entity] type=${n.entityType} instance=${String(n.instance).padStart(3)} x=${n.position.x.toFixed(2).padStart(7)}  y=${n.position.y.toFixed(2).padStart(7)}  z=${n.position.z.toFixed(2).padStart(7)}`,
        )
      }
      console.debug(`[entity] total: ${nodes.length} entity-node markers rendered (types: ${entityTypes.join(', ')})`)
    }
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

    // Round timer — advances only during countdown and playing states.
    this.roundManager.tick(simDelta)

    if (this.navDebugEnabled) this.logNavDebug(simDelta)
  }

  /**
   * `?navdebug` (EX-1.3) — correlate stair/fall-through glitches with the numbers.
   * Logs at ~10 Hz, and immediately on any single-tick Y jump > 25 cm (a pop or a
   * fall), the final post-correction player Y vs the terrain-sampler floor, the
   * probe-Y origin the sampler casts from, and the step lift / wall push the entity
   * applied this tick.  `gap` = feet (Y − capsule half-height) minus floorY:
   * ≈0 grounded · large positive = airborne · negative = sunk through the floor.
   */
  private logNavDebug(simDelta: number): void {
    const character = this.getCharacter()
    const y = character.position.y
    const dY = y - this.navLastY
    this.navLogAccum += simDelta
    const jump = Math.abs(dY) > 0.25
    if (this.navLogAccum < 0.1 && !jump) {
      this.navLastY = y
      return
    }
    this.navLogAccum = 0
    const x = character.position.x
    const z = character.position.z
    const floorY = this.sampleTerrainSurfaceY(x, z)
    const probeY = this.navProbeFromY?.() ?? NaN
    const gap = y - PLAYER_CAPSULE_HALF_HEIGHT - floorY
    console.debug(
      `[dbox/nav]${jump ? ' JUMP' : ''} ` +
      `y=${y.toFixed(3)} dY=${dY.toFixed(3)} floorY=${floorY.toFixed(3)} gap=${gap.toFixed(3)} ` +
      `probeY=${probeY.toFixed(2)} lift=${(this.entity?.lastStepLiftY ?? 0).toFixed(3)} ` +
      `push=${(this.entity?.lastWallPushDepth ?? 0).toFixed(3)} xz=(${x.toFixed(1)},${z.toFixed(1)})`,
    )
    this.navLastY = y
  }

  /** Returns a pure-data snapshot of the current round state for UI polling. */
  getRoundSnapshot(): RoundSnapshot {
    return this.roundManager.getSnapshot()
  }

  protected override handleJumpPressedEarly(): boolean {
    return this.lab.handleJumpPressedEarly()
  }
}

/** Pool bounds — alias of {@link CALIBRATION_POOL_BOUNDS} for legacy imports. */
export const DBOX_POOL_BOUNDS = CALIBRATION_POOL_BOUNDS
