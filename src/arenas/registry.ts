import type { RouteLocationRaw } from 'vue-router'
import type { DboxSceneModuleOptions } from '@/modules/DboxSceneModule'
import { dboxScene } from '@/scenes/dbox'
import { CHATEAU_GUILLARD } from '@/maps/chateauGuillard'

export interface ArenaEntry {
  /** Route-safe slug — OW map slug or 'sandbox'. */
  id: string
  label: string
  sub: string
  /** Tailwind class string for the menu button accent. */
  accent: string
  /**
   * Vue Router location. Named routes keep this base-path-safe when deployed
   * under a sub-path (e.g. GitHub Pages).  Do NOT use raw path strings.
   */
  route: RouteLocationRaw
  options: DboxSceneModuleOptions
}

/**
 * Central registry of all playable arenas.
 * To add a map: create src/maps/<name>.ts (MapDescriptor), add an entry here.
 * MenuView and DboxView derive everything from this list — no other edits needed.
 */
export const ARENA_REGISTRY: ArenaEntry[] = [
  {
    id: 'chateau-guillard',
    label: 'Château Guillard',
    sub: 'OW1 map · Rapier physics',
    accent: 'bg-violet-900 hover:bg-violet-800 active:bg-violet-950 text-violet-100',
    route: { name: 'dbox', query: { arena: 'chateau-guillard' } },
    options: { descriptor: dboxScene, map: CHATEAU_GUILLARD },
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    sub: 'Calibration arena',
    accent: 'bg-cyan-900 hover:bg-cyan-800 active:bg-cyan-950 text-cyan-100',
    route: { name: 'dbox' },
    options: { descriptor: dboxScene },
  },
]
