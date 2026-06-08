import type { MapDescriptor } from './MapDescriptor'

/**
 * Château Guillard — OW1 map sourced from Open3DLab.
 *
 * GLB export spec (Blender → File → Export → glTF 2.0):
 *   Format: glTF Binary (.glb)
 *   Transform: Y Up ✓ (Z-up → Three.js Y-up)
 *   Geometry: Apply Modifiers ✓, Draco Compression ✓ level 6
 *
 * Spawn calibration: (30, −15) is confirmed walkable interior (east-wing purple
 * room, floor Y ≈ −0.97) but is a heal-powerup corner with walls N+E.
 * TODO: update spawnX/spawnZ after visual calibration to a more open combat area.
 */
export const CHATEAU_GUILLARD: MapDescriptor = {
  glbUrl: '/maps/chateau-guillard.glb',
  spawnX: 30,
  spawnZ: -15,
  // Exclude OWLib rig-visualisation helpers — small cylinders that trap the player.
  physicsFilter: mesh => !/^smd_bone_vis/i.test(mesh.name),
  // OWLib material type-code prefixes for non-architectural effect/spawn volumes.
  // Names are formatted TypeCode_Hash (no colon), e.g. '13A_81B09AB0F566B1D2'.
  owlibTechMat: /\b(13A|9F|9C|9A|B2|10F|F0)_/,
}
