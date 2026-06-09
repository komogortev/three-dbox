import type { MapDescriptor } from './MapDescriptor'

/**
 * Château Guillard — OW1 map sourced from Open3DLab.
 *
 * GLB export spec (Blender → File → Export → glTF 2.0):
 *   Format: glTF Binary (.glb)
 *   Transform: Y Up ✓ (Z-up → Three.js Y-up)
 *   Geometry: Apply Modifiers ✓, Draco Compression ✓ level 6
 *
 * Spawn points — candidate positions extracted from GLB small-mesh markers
 * (≤8-tri OWLib entity quads).  Enable debugMarkers below to see green spheres
 * at all markers in-game; console.debug logs exact world XYZ for calibration.
 *
 * Identified clusters (GLTF hierarchy traversal + Three.js getWorldPosition):
 *   • Ground-level pickup cluster:   X≈9.4,  Z≈1.0
 *   • Upper-corridor symmetric pair: X≈12.8 / 23.6, Z≈-12,  Y≈6.9
 *   • Elevated-section pickup:       X≈-30,  Z≈2
 *   • Ground-level single marker:    X≈19.6, Z≈-12.6
 */
export const CHATEAU_GUILLARD: MapDescriptor = {
  glbUrl: '/maps/chateau-guillard.glb',
  // Fallback spawn — east-wing interior, confirmed walkable.
  spawnX: 30,
  spawnZ: -15,
  // Candidate health-pack spawn positions; random one is selected each mount.
  // Verify in-game with debugMarkers: true and adjust after visual confirmation.
  spawnPoints: [
    [9.4,   1.0],   // ground-level pickup cluster
    [12.8, -12.3],  // upper corridor — symmetric marker A
    [23.6, -12.1],  // upper corridor — symmetric marker B
    [-30,    2.0],  // elevated-section pickup
    [19.6, -12.6],  // ground-level single marker
  ],
  // Exclude OWLib rig-visualisation helpers — small cylinders that trap the player.
  physicsFilter: mesh => !/^smd_bone_vis/i.test(mesh.name),
  // OWLib material type-code prefixes for non-architectural effect/spawn volumes.
  // Names are formatted TypeCode_Hash (no colon), e.g. '13A_81B09AB0F566B1D2'.
  owlibTechMat: /\b(13A|9F|9C|9A|B2|10F|F0)_/,
  // Set true to render green spheres at all ≤8-tri marker nodes and log positions.
  debugMarkers: false,
}
