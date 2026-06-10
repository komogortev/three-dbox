import type { RoundState, RoundSnapshot } from './types'

/** Seconds of pre-round countdown before gameplay begins. */
const COUNTDOWN_DURATION = 3

/** Default round length in seconds. */
export const DEFAULT_ROUND_DURATION = 60

/**
 * Manages the round lifecycle: countdown → playing → ended.
 *
 * Tick is driven by DboxSceneModule.onAfterGameplayTick (simDelta in seconds).
 * Exposes a pure snapshot consumed by DboxView for overlay rendering.
 *
 * State machine:
 *   idle ──start()──▶ countdown ──timer─▶ playing ──timer─▶ ended
 *          reset() can be called from any state to return to idle.
 */
export class RoundManager {
  private state: RoundState = 'idle'
  private countdownTimer = 0
  private roundTimer = 0
  private readonly duration: number

  constructor(duration = DEFAULT_ROUND_DURATION) {
    this.duration = duration
  }

  /**
   * Begin the pre-round countdown.
   * Call once per mount (DboxSceneModule.onMount).
   */
  start(): void {
    this.state = 'countdown'
    this.countdownTimer = COUNTDOWN_DURATION
    this.roundTimer = 0
  }

  /**
   * Return to idle without advancing time.
   * Call on unmount so a remount triggers a fresh round.
   */
  reset(): void {
    this.state = 'idle'
    this.countdownTimer = 0
    this.roundTimer = 0
  }

  /**
   * Advance the timer by dt seconds (matches simDelta units).
   * No-op when idle or ended.
   */
  tick(dt: number): void {
    if (this.state === 'countdown') {
      this.countdownTimer -= dt
      if (this.countdownTimer <= 0) {
        this.state = 'playing'
        this.roundTimer = 0
      }
    } else if (this.state === 'playing') {
      this.roundTimer += dt
      if (this.roundTimer >= this.duration) {
        this.roundTimer = this.duration
        this.state = 'ended'
      }
    }
  }

  getSnapshot(): RoundSnapshot {
    return {
      state: this.state,
      countdownRemaining: Math.ceil(this.countdownTimer),
      timeRemaining: Math.max(0, this.duration - this.roundTimer),
      elapsed: this.roundTimer,
    }
  }
}
