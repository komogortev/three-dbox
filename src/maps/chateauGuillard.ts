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
 *   447 _Skeleton roots (OWLib model instances) · 26 unique model IDs
 *   Material format: "Château Guillard:<TypeCode>_<MeshHash>"
 *
 * Blender collection hierarchy extracted via headless Blender 5.0 script.
 * Collection names do NOT survive GLB export — used as documentation only.
 * Mountain/fog exclusions are expressed as mesh-name hash patterns instead.
 */
const CHATEAU_GUILLARD_DATA: MapDescriptorData = {
  id: 'chateau-guillard',
  name: 'Château Guillard',
  glbUrl: '/maps/chateau-guillard.glb',

  // Spawn points extracted from ≤8-tri OWLib entity marker quads.
  // Zone labels derived from Blender collection membership.
  // Enable debugMarkers to re-calibrate with green spheres in-game.
  spawnPoints: [
    { label: 'yard-ground-pickup-cluster',    x:   9.4, z:   1.0 },
    { label: 'mainhall-upper-corridor-a',     x:  12.8, z: -12.3 },
    { label: 'mainhall-upper-corridor-b',     x:  23.6, z: -12.1 },
    { label: 'otherparts-elevated-pickup',    x: -30.0, z:   2.0 },
    { label: 'otherparts-ground-single',      x:  19.6, z: -12.6 },
  ],
  // Fallback: east-wing interior (OtherParts zone), confirmed walkable.
  spawnFallback: { x: 30, z: -15 },

  physics: {
    // Patterns tested against mesh.name (case-insensitive). Any match = excluded
    // from Rapier trimesh and terrain sampler.
    //
    // Mesh naming convention: Submesh_<N>.<HASH>.<instance>
    // Hashes exclusive to non-playable collections are safe to match via '\.HASH\.'.
    excludeNamePatterns: [
      // OWLib rig-visualisation helpers — small bone cylinders that trap the capsule.
      '^smd_bone_vis',

      // MapOutsideMountains (201 meshes) + clouds (35 meshes subset) — background terrain
      // visible through the windows. Hashes confirmed exclusive to this collection
      // via headless Blender extraction. Excluding saves ~236 Rapier trimesh colliders
      // and prevents incorrect floor-Y reads at map edges.
      //
      // NOTE: Three.js PropertyBinding.sanitizeNodeName() strips dots from node names,
      // so Blender's "Submesh_0.HASH.443" becomes "Submesh_0HASH443" in Three.js.
      // Pattern must match the hash as a bare substring — no dot anchors.
      '(?:1597A365FD2BE281|1C9078CD362A142D|2478AD61C6FC6F90|3D8859984468C18F|778596F2709115B2|B2E0C8C014365A04)',

      // LightingSetup/extrafogs — 6 plain Blender cubes.
      // Blender names: Cube, Cube.001–005 → sanitized: Cube, Cube001–005.
      '^Cube\\d*$',
    ],
  },

  owlib: {
    // Material type-code prefixes (hex). Format: "Château Guillard:<TypeCode>_<MeshHash>"
    // These tag non-architectural volumes hidden visually but kept in the terrain sampler.
    //
    // Full type-code inventory from GLB JSON chunk (168 materials total):
    //   0x00  96 mats — architectural default              (always visible)
    //   0x01–0x03, 0x0B  — architectural variants          (always visible)
    //   0x74–0xCC range  — architectural surface types     (always visible)
    //   0x9A  2 mats — effect zone                        ← hidden
    //   0x9C  1 mat  — effect zone variant                ← hidden
    //   0x9F  1 mat  — effect zone variant                ← hidden
    //   0xB2  1 mat  — sound / audio zone                 ← hidden
    //   0xF0  1 mat  — ambient / sky volume               ← hidden
    //   0x10F 1 mat  — lighting volume                    ← hidden
    //   0x13A 1 mat  — trigger / spawn quad               ← hidden
    hiddenTypeCodes: ['9A', '9C', '9F', 'B2', 'F0', '10F', '13A'],

    // OWLib entity ID annotations (node names: "Entity <HexId>.<instance>").
    entityTypes: {
      // ── Architectural / static prop types (high instance count) ───────────
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
      '0ED2': 'entity-marker (×2 — upper-corridor, used as spawn calibration points)',
      '011B': 'entity-unknown (×1)',
      '033E': 'entity-unknown (×1)',
      '036B': 'entity-unknown (×1)',
      '04A8': 'entity-unknown (×1)',
      '0CB6': 'entity-unknown (×1)',
    },
  },

  // ── Display overrides ────────────────────────────────────────────────────────
  // Applied after terrain sampler setup — runs on ALL meshes including those
  // excluded from Rapier, so background zones can be hidden here.
  display: {
    meshOverrides: [
      {
        // MapOutsideMountains (201 meshes) — background terrain seen through windows.
        // Hidden entirely: shows skybox instead of stone cliffs, reduces draw calls.
        // Hashes confirmed exclusive to this collection via Blender extraction.
        // Three.js sanitizes dots out of node names — match hash as bare substring.
        namePattern: '(?:1597A365FD2BE281|1C9078CD362A142D|2478AD61C6FC6F90|3D8859984468C18F|778596F2709115B2|B2E0C8C014365A04)',
        opacity: 0.0,
      },
      {
        // LightingSetup/extrafogs — 6 plain Blender cubes (Cube, Cube.001–005).
        // Three.js sanitizes "Cube.001" → "Cube001"; pattern uses \d* not \.\d+.
        namePattern: '^Cube\\d*$',
        opacity: 0.0,
      },
    ],
  },

  // ── Blender scene documentation ─────────────────────────────────────────────
  // Extracted via: blender --background <file.blend> --python extract_collections.py
  // Blender 5.0 · file: FullOWMap_Chateau_Guillard_Eevee_packed_MeltRib_V2.blend
  // Collection names do NOT appear as GLB nodes — this is authoring reference only.
  blenderScene: {
    collections: [
      {
        name: 'FullMapThings', role: 'unknown', objects: 0,
        notes: 'Root grouping — no direct objects, contains all subcollections',
        children: [
          {
            name: 'MainParts', role: 'unknown', objects: 0,
            notes: 'Grouping for the three playable zones',
            children: [
              {
                name: 'MainHall', role: 'playable', objects: 616,
                skeletonInstances: 69,
                modelIds: ['000000000619','000000000EF8','000000001CED','0000000025CA',
                           '000000002D37','0000000031C9','0000000031CA','0000000031CC',
                           '00000000326E','000000003324','0000000034BF','000000003791',
                           '000000003792','0000000037A8','000000003B7C','00000000501D'],
                notes: '457 MESH + 89 EMPTY + 1 SPEAKER. Interior hall, upper corridors.',
              },
              {
                name: 'Yard', role: 'playable', objects: 846,
                skeletonInstances: 126,
                modelIds: ['000000000619','000000000EF8','000000001CED','0000000025CA',
                           '000000002695','0000000026C4','0000000026CC','0000000027B9',
                           '000000002D37','0000000031CC','0000000034BF','000000003791',
                           '000000003792','0000000037A8','00000000501D','000000005022'],
                notes: '531 MESH + 185 EMPTY + 4 SPEAKER. Outdoor courtyard — primary combat area.',
              },
              {
                name: 'OtherParts', role: 'playable', objects: 2124,
                skeletonInstances: 377,
                modelIds: ['0000000007F8','0000000025CA','000000002695','0000000026C4',
                           '0000000026CC','0000000027B9','000000002C9C','000000002D37',
                           '0000000031C4','0000000031C9','0000000031CC','000000003791',
                           '000000003792','0000000037A8','000000003DF2','00000000501D',
                           '000000005022'],
                notes: '1260 MESH + 482 EMPTY + 5 SPEAKER. Surrounding structures, bridges, elevated sections.',
              },
              {
                name: 'wateredgewaves', role: 'effects', objects: 119,
                notes: '119 MESH. Water-edge animated planes (material: wavesedge). ' +
                       'Kept in physics — water planes act as floor at map boundary. ' +
                       'Hash 81B09AB0F566B1D2 shared with castle walls; cannot distinguish by name.',
              },
            ],
          },
          {
            name: 'MapOutsideMountains', role: 'background', objects: 201,
            exclusiveMeshHashes: [
              '1597A365FD2BE281', '1C9078CD362A142D', '2478AD61C6FC6F90',
              '3D8859984468C18F', '778596F2709115B2', 'B2E0C8C014365A04',
            ],
            notes: '201 plain MESH (no skeletons). Background terrain visible through windows. ' +
                   'Excluded from physics via exclusiveMeshHashes name patterns.',
            children: [
              {
                name: 'clouds', role: 'background', objects: 35,
                notes: '35 MESH. Uses shared hash 81B09AB0F566B1D2 (instances .441–.450+). ' +
                       'Cannot distinguish from castle walls by name alone; left in physics.',
              },
            ],
          },
          {
            name: 'LightingSetup', role: 'lighting', objects: 4,
            notes: '2 LIGHT + 1 MESH + 1 LIGHT_PROBE. Lights not exported as GLB meshes.',
            children: [
              {
                name: 'extralights', role: 'lighting', objects: 46,
                notes: '45 LIGHT + 1 EMPTY. Not in GLB mesh hierarchy.',
              },
              {
                name: 'extrafogs', role: 'effects', objects: 6,
                notes: '6 plain Blender cubes (named Cube, Cube.001–005, material: Material.002). ' +
                       'Excluded from physics via name pattern ^Cube\\d*$ (Three.js strips dots: Cube.001 → Cube001).',
              },
            ],
          },
          {
            name: 'ExtraStuff', role: 'unknown', objects: 27,
            notes: '27 MESH at root. Unknown role — left in physics.',
            children: [
              {
                name: 'MainParents', role: 'entities', objects: 5649,
                skeletonInstances: 1,
                modelIds: ['00000000111E'],
                notes: '5476 EMPTY + 172 MESH + 1 skeleton. ' +
                       'EMPTYs are Entity XXXXXXXX OW game-object nodes (health packs, spawns, triggers). ' +
                       '172 MESHes are ≤8-tri marker quads — hidden visually, kept in terrain sampler.',
              },
              {
                name: 'MoreStuff', role: 'unknown', objects: 503,
                notes: '503 MESH. Hashes overlap with playable zones (014F64135F209FC7 primary). ' +
                       'Cannot safely exclude — left in physics.',
              },
            ],
          },
        ],
      },
    ],
  },

  debugMarkers: false,
}

export const CHATEAU_GUILLARD = compileMapDescriptor(CHATEAU_GUILLARD_DATA)
