import type { EngineContext } from '@base/engine-core'
import type { ThreeContext } from '@base/threejs-engine'
import type { SceneDescriptor } from '@base/scene-builder'
import { CALIBRATION_POOL_BOUNDS } from '@/calibration/calibrationLayout'
import { SandboxSceneModule } from './SandboxSceneModule'
import { DboxLab } from './dbox/DboxLab'
import type { GameplayLabHost } from './dbox/GameplayLabHost'
import type { ThirdPersonSceneConfig } from './GameplaySceneModule'
import { DboxCharacterEntity } from '@/entities/DboxCharacterEntity'
import { DBOX_ARENA_WALLS, DBOX_ARENA_BOXES, buildArenaWallMeshes } from '@/collision'
import type { ChampionConfig } from '@/champions/ChampionConfig'
import { DOOMFIST_CONFIG } from '@/champions/doomfist'

export type DboxSceneModuleOptions = Partial<ThirdPersonSceneConfig> & {
  descriptor?: SceneDescriptor
  /** Override champion config. Defaults to {@link DOOMFIST_CONFIG}. */
  champion?: ChampionConfig
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
  private entity: DboxCharacterEntity | null = null
  private arenaMeshes: THREE.Object3D[] = []

  constructor(options: DboxSceneModuleOptions = {}) {
    const { champion = DOOMFIST_CONFIG, ...rest } = options
    super({
      ...rest,
      characterSpeed: rest.characterSpeed ?? champion.movement.walkSpeed,
      carryImpulseDecayPerSecond: rest.carryImpulseDecayPerSecond ?? champion.movement.carryImpulseDecayPerSecond,
    })
    this.champion = champion
    this.lab = new DboxLab(this, champion)
  }

  getCarryImpulseDecayPerSecond(): number {
    return this.cfg.carryImpulseDecayPerSecond ?? this.champion.movement.carryImpulseDecayPerSecond
  }

  /** Expose entity for external access (e.g. DboxLab blob collision). */
  getEntity(): DboxCharacterEntity | null {
    return this.entity
  }

  protected override async onMount(container: HTMLElement, context: EngineContext): Promise<void> {
    await super.onMount(container, context)
    const ctx = context as ThreeContext

    // ── Character entity (collision correction layer) ────────────────────
    this.entity = new DboxCharacterEntity(
      () => this.getPlayerController(),
      () => this.getCharacter(),
      this.champion.collision,
    )
    this.entity.setCollisionGeometry(DBOX_ARENA_WALLS, DBOX_ARENA_BOXES)

    // ── Arena wall visual meshes ────────────────────────────────────────
    this.arenaMeshes = buildArenaWallMeshes()
    for (const m of this.arenaMeshes) ctx.scene.add(m)

    this.lab.mount(container, context.eventBus, ctx)
    this.lab.setWallGeometry(DBOX_ARENA_WALLS, DBOX_ARENA_BOXES)
  }

  protected override async onUnmount(): Promise<void> {
    this.lab.unmount()
    for (const m of this.arenaMeshes) m.parent?.remove(m)
    this.arenaMeshes = []
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
