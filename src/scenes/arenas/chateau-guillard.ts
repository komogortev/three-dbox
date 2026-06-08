import type { DboxSceneModuleOptions } from '@/modules/DboxSceneModule'
import { dboxScene } from '../dbox'

/**
 * Château Guillard arena — OW1 map sourced from Open3DLab.
 *
 * GLB export spec (Blender → File → Export → glTF 2.0):
 *   Format: glTF Binary (.glb)
 *   Transform: Y Up ✓ (Z-up → Three.js Y-up)
 *   Geometry: Apply Modifiers ✓, Draco Compression ✓ level 6
 *   Floor of playable area should sit at Y≈0 before export.
 *
 * Drop the exported file at: public/maps/chateau-guillard.glb
 */
export const chateauGuilardArena: { label: string; options: DboxSceneModuleOptions } = {
  label: 'Château Guillard',
  options: {
    descriptor: dboxScene,
    mapGlbUrl: '/maps/chateau-guillard.glb',
  },
}
