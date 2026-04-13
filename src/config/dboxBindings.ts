import { DEFAULT_BINDINGS, mergeBindings } from '@base/input'
import type { InputBindings } from '@base/input'

/**
 * Dbox game-specific default bindings — applied on top of engine defaults.
 * - `interact` cleared: KeyE is reserved for Seismic Slam (ability_secondary).
 * - Ability slots pre-bound to Q / E so settings shows them as defaults, not "Unbound".
 *
 * Used both in DboxView (as the base for user override merging)
 * and in SettingsView (as the base for displaying current effective keys).
 */
export const DBOX_DEFAULT_BINDINGS: InputBindings = mergeBindings(DEFAULT_BINDINGS, {
  keyboard: {
    interact:           [],
    ability_primary:    ['KeyQ'],   // Ability 2 — Rising Uppercut
    ability_secondary:  ['KeyE'],   // Ability 3 — Seismic Slam
    ability_tertiary:   [],         // Ability 1 — Rocket Punch (mouse-driven by default)
    ability_quaternary: [],         // Ability 4 — Meteor Strike (not yet implemented)
  },
  gamepad: {
    ability_primary:    [3],
    ability_secondary:  [2],
    ability_tertiary:   [],
    ability_quaternary: [],
    toggle_camera:      [8],
  },
} as unknown as Partial<InputBindings>)
