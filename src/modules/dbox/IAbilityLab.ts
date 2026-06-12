import type { EventBus } from '@base/engine-core'
import type { ThreeContext } from '@base/threejs-engine'
import type { WallPlane, WallBox } from '@/collision'
import type { AbilityHudEntry } from '@/hud/types'

/**
 * Contract between DboxSceneModule and a champion's ability implementation.
 * Holding IAbilityLab instead of a concrete class enables multi-champion support.
 */
export interface IAbilityLab {
  mount(container: HTMLElement, eventBus: EventBus, ctx: ThreeContext, opts?: { spawnBlobs?: boolean }): void
  unmount(): void
  beforeGameplayTick(): void
  afterGameplayTick(simDelta: number, ctx: ThreeContext): void
  handleJumpPressedEarly(): boolean
  getHudAbilities(): AbilityHudEntry[]
  setWallGeometry(walls: WallPlane[], boxes: WallBox[]): void
}
