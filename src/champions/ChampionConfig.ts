/**
 * Champion configuration — all gameplay-tunable params for a Doomfist-style champion.
 *
 * Rendering-only constants (blob visuals, cone segment count, ray step sizes)
 * stay local to their respective modules.
 */

export interface ChampionMovementConfig {
  /** Base walk/run speed (m/s). */
  walkSpeed: number
  /** Exponential carry decay rate (1/s) applied to planar carry velocity. */
  carryImpulseDecayPerSecond: number
}

export interface ChampionCollisionConfig {
  /** Player circle radius for wall collision resolve (m). */
  playerRadius: number
  /** Fraction of carry speed lost on wall contact (0–1). */
  slideFriction: number
  /** Impacts within this angle from wall normal are treated as head-on (degrees). */
  headOnAngleDeg: number
  /** Minimum carry speed (m/s) below which carry collision resolve is skipped. */
  carryThreshold: number
}

export interface RocketPunchConfig {
  /** Cooldown (s). */
  cooldownS: number
  /** Maximum charge hold time (s). */
  chargeMaxS: number
  /** Launch speed at minimum charge (m/s). */
  speedMin: number
  /** Launch speed at maximum charge (m/s). */
  speedMax: number
  /** Vertical self-lift impulse at minimum charge (m/s). */
  selfLiftVyMin: number
  /** Vertical self-lift impulse at maximum charge (m/s). */
  selfLiftVyMax: number
  /** Minimum planar carry speed (m/s) required to activate skim-jump during punch. */
  skimMinCarry: number
}

export interface RisingUppercutConfig {
  /** Cooldown (s). */
  cooldownS: number
  /** Planar carry speed applied on uppercut (m/s). */
  forwardSpeed: number
  /** Vertical impulse applied on uppercut (m/s). */
  upSpeed: number
  /** XZ radius within which NPC blobs are hit (m). */
  hitRadiusXZ: number
  /** Cone half-angle for NPC hit detection (degrees, full cone). */
  hitConeDeg: number
  /** Maximum Y delta between player and blob to count as a hit (m). */
  hitMaxYDelta: number
  /** Duration NPC blobs remain locked (lifted) after uppercut hit (s). */
  victimLockS: number
  /** Gravity applied to locked NPCs during their lock duration (m/s²). */
  npcGravity: number
  /**
   * Extra forward carry bias applied to NPCs based on move intent (0–1 forward).
   * Adds feel to the move — punching forward hurls blobs further.
   */
  npcMoveIntentForwardBias: number
}

export interface SeismicSlamConfig {
  /** Cooldown (s). */
  cooldownS: number
  /** Vertical velocity applied to player on slam (m/s, negative = downward). */
  downSpeed: number
  /** AoE cone range from slam apex (m). */
  coneRangeM: number
  /** AoE cone angle (degrees, full cone). */
  coneDeg: number
  /** Minimum speed of player dash to slam apex (m/s). */
  toApexSpeedMin: number
  /** Maximum speed of player dash to slam apex (m/s). */
  toApexSpeedMax: number
  /** Fallback aim distance when mouse ray misses ground (m). */
  mouseFallbackM: number
}

export interface ChampionConfig {
  movement: ChampionMovementConfig
  collision: ChampionCollisionConfig
  rocketPunch: RocketPunchConfig
  risingUppercut: RisingUppercutConfig
  seismicSlam: SeismicSlamConfig
}
