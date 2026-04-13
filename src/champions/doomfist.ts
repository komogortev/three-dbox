import type { ChampionConfig } from './ChampionConfig'

/**
 * OW1 late-era Doomfist champion configuration.
 * Values match the original hardcoded constants — extracted here for tuning without touching logic.
 */
export const DOOMFIST_CONFIG: ChampionConfig = {
  movement: {
    walkSpeed: 5.5,
    carryImpulseDecayPerSecond: 8,
  },

  collision: {
    playerRadius: 0.4,
    slideFriction: 0.12,
    headOnAngleDeg: 30,
    carryThreshold: 0.5,
  },

  rocketPunch: {
    cooldownS: 4,
    chargeMaxS: 1.4,
    speedMin: 78,
    speedMax: 152,
    selfLiftVyMin: 1.65,
    selfLiftVyMax: 3.15,
    skimMinCarry: 22,
  },

  risingUppercut: {
    cooldownS: 6,
    forwardSpeed: 4,
    upSpeed: 26,
    hitRadiusXZ: 4.25,
    hitConeDeg: 105,
    hitMaxYDelta: 2.85,
    victimLockS: 0.6,
    npcGravity: 30,
    npcMoveIntentForwardBias: 0.85,
  },

  seismicSlam: {
    cooldownS: 6,
    downSpeed: -24,
    coneRangeM: 7.25,
    coneDeg: 86,
    toApexSpeedMin: 8,
    toApexSpeedMax: 22,
    mouseFallbackM: 20,
  },
}
