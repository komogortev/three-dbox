/** Pure-display HUD state — computed by the game layer, read by the UI layer. */

export interface AbilityHudEntry {
  id: string
  name: string
  /** Display label for the keybind: "LMB", "RMB", "E", "SHIFT", etc. */
  key: string
  /** Total cooldown duration (seconds). 0 = no cooldown (always ready). */
  cooldownMax: number
  /** Seconds remaining on cooldown. 0 = ready. */
  cooldownLeft: number
  /** True while the ability is actively executing (e.g. charging rocket punch). */
  isActive: boolean
}

export interface HudSnapshot {
  health: number
  healthMax: number
  shields: number
  shieldsMax: number
  abilities: AbilityHudEntry[]
}
