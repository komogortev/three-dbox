/** Round lifecycle state. */
export type RoundState = 'idle' | 'countdown' | 'playing' | 'ended'

/**
 * Pure-data snapshot of round state — polled each frame by DboxView.
 * No game logic lives here; this is a display contract only.
 */
export interface RoundSnapshot {
  state: RoundState
  /**
   * Whole seconds remaining in the pre-round countdown (3 → 2 → 1).
   * Meaningful only when state === 'countdown'.
   */
  countdownRemaining: number
  /**
   * Seconds remaining in the active round (counts down from duration).
   * Meaningful only when state === 'playing' | 'ended'.
   */
  timeRemaining: number
  /**
   * Seconds elapsed since round start.
   * Useful for results screen (time survived = elapsed at state === 'ended').
   */
  elapsed: number
}
