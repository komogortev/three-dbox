import { compileMapDescriptor, type MapDescriptorData } from './MapDescriptor'

/**
 * Château Guillard — OW1 Deathmatch map, sourced from Open3DLab.
 *
 * GLB export spec (Blender → File → Export → glTF 2.0):
 *   Format: glTF Binary (.glb)
 *   Transform: Y Up ✓ (Z-up → Three.js Y-up)
 *   Geometry: Apply Modifiers ✓, Draco Compression ✓ level 6
 *
 * GLB inventory (extracted from JSON chunk):
 *   374 meshes · 168 materials · 5 186 nodes
 *   Material format: "Château Guillard:<TypeCode>_<MeshHash>"
 *
 * Spawn points are extracted from ≤8-tri OWLib entity marker quads.
 * Enable debugMarkers to render green spheres at all markers in-game;
 * console.debug logs exact world XYZ for calibration.
 */
const CHATEAU_GUILLARD_DATA: MapDescriptorData = {
  id: 'chateau-guillard',
  name: 'Château Guillard',
  glbUrl: '/maps/chateau-guillard.glb',

  // Candidate health-pack / entity-marker spawn positions.
  // Labels match OWLib debug output (enable debugMarkers to re-calibrate).
  spawnPoints: [
    { label: 'ground-pickup-cluster', x:   9.4, z:   1.0 },
    { label: 'upper-corridor-a',      x:  12.8, z: -12.3 },
    { label: 'upper-corridor-b',      x:  23.6, z: -12.1 },
    { label: 'elevated-pickup',       x: -30.0, z:   2.0 },
    { label: 'ground-single',         x:  19.6, z: -12.6 },
  ],
  // Fallback: east-wing interior, confirmed walkable.
  spawnFallback: { x: 30, z: -15 },

  physics: {
    // smd_bone_vis — OWLib rig-visualisation helpers: small cylinders that trap
    // the player capsule if included in the Rapier trimesh.
    excludeNamePattern: '^smd_bone_vis',
  },

  owlib: {
    // Non-architectural material type-code prefixes (hex).
    // These tag trigger volumes, effect zones, sound zones, and lighting volumes.
    // Meshes are hidden visually but kept in the terrain sampler for floor-Y grounding.
    //
    // Full type-code inventory (from GLB JSON chunk, 168 materials):
    //   0x00  96 mats — architectural default (always visible)
    //   0x01–0x03, 0x0B, 0x74–0xCC  — architectural variants (always visible)
    //   0x9A  2 mats — effect zone           ← hidden
    //   0x9C  1 mat  — effect zone variant   ← hidden
    //   0x9F  1 mat  — effect zone variant   ← hidden
    //   0xB2  1 mat  — sound/audio zone      ← hidden
    //   0xF0  1 mat  — ambient / sky volume  ← hidden
    //   0x10F 1 mat  — lighting volume       ← hidden
    //   0x13A 1 mat  — trigger / spawn quad  ← hidden
    hiddenTypeCodes: ['9A', '9C', '9F', 'B2', 'F0', '10F', '13A'],

    // OWLib entity ID annotations (from GLB node names: "Entity <HexId>.<N>").
    // High-count IDs are architectural prop types; low-count IDs are game objects.
    entityTypes: {
      // ── Architectural / static prop types ─────────────────────────────────
      '1211': 'static-prop-primary (×140 — main architectural element)',
      '161A': 'static-prop-variant-a (×107)',
      '161E': 'static-prop-variant-b (×65)',
      '25AE': 'static-prop-variant-c (×18)',
      '1210': 'static-prop-detail (×20)',
      '161D': 'static-prop-detail-b (×17)',
      '146A': 'static-prop-ornament (×13)',
      '146B': 'static-prop-ornament-b (×6)',
      '146D': 'static-prop-ornament-c (×7)',
      '1212': 'static-prop-minor (×12)',
      '16C8': 'static-prop-rare (×8)',
      '1E33': 'static-prop-rare-b (×10)',
      '1E2E': 'static-prop-rare-c (×5)',
      '1E35': 'static-prop-rare-d (×3)',
      '1E36': 'static-prop-rare-e (×3)',
      '1368': 'static-prop-unique-a (×2)',
      '1379': 'static-prop-unique-b (×2)',
      '13DD': 'static-prop-unique-c (×2)',
      '12BB': 'static-prop-unique-d (×3)',
      '1488': 'static-prop-unique-e (×2)',
      '1BBE': 'static-prop-unique-f (×2)',
      '25F1': 'static-prop-unique-g (×2)',
      // ── Game object / interactive entity types ────────────────────────────
      '0345': 'spawn-volume (×2 — player start locations, one per team)',
      '0ED2': 'entity-marker (×2 — upper-corridor region, used as spawn calibration)',
      '011B': 'entity-unknown (×1)',
      '033E': 'entity-unknown (×1)',
      '036B': 'entity-unknown (×1)',
      '04A8': 'entity-unknown (×1)',
      '0CB6': 'entity-unknown (×1)',
      '122C': 'entity-unknown (×1)',
      '13D9': 'entity-unknown (×1)',
      '145C': 'entity-unknown (×1)',
      '146F': 'entity-unknown (×1)',
      '1470': 'entity-unknown (×1)',
      '1489': 'entity-unknown (×1)',
      '148A': 'entity-unknown (×1)',
      '149F': 'entity-unknown (×1)',
      '14D8': 'entity-unknown (×1)',
      '14D9': 'entity-unknown (×1)',
      '155B': 'entity-unknown (×1)',
      '17E4': 'entity-unknown (×1)',
      '1B89': 'entity-unknown (×1)',
      '1F1C': 'entity-unknown (×1)',
      '25F0': 'entity-unknown (×1)',
    },
  },

  // Set true to render green spheres at all ≤8-tri marker nodes and log positions.
  debugMarkers: false,
}

export const CHATEAU_GUILLARD = compileMapDescriptor(CHATEAU_GUILLARD_DATA)
