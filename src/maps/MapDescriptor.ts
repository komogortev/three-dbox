import type * as THREE from 'three'

// ── Runtime form (consumed by DboxSceneModule) ────────────────────────────────

/**
 * Per-map runtime configuration for DboxSceneModule.
 * Prefer authoring via {@link MapDescriptorData} + {@link compileMapDescriptor}.
 */
export interface MapDescriptor {
  /** Path to the GLB file under /public, e.g. '/maps/chateau-guillard.glb'. */
  glbUrl: string
  /** Fallback spawn X coordinate when spawnPoints is absent or empty. */
  spawnX: number
  /** Fallback spawn Z coordinate. */
  spawnZ: number
  /**
   * Candidate spawn positions [x, z].  When provided, a random entry is used
   * each mount instead of spawnX/spawnZ.  Floor Y is sampled at runtime.
   */
  spawnPoints?: [number, number][]
  /**
   * Return false to exclude a Mesh from Rapier trimesh and terrain sampler.
   * Defaults to including all meshes when omitted.
   */
  physicsFilter?: (mesh: THREE.Mesh) => boolean
  /**
   * Regex matching OWLib technical material-name prefixes.
   * Matching meshes are hidden visually at load but kept in the terrain sampler.
   */
  owlibTechMat?: RegExp
  /**
   * Dev flag: render a visible green sphere at every ≤8-triangle mesh node and
   * log its world position to console.debug.  Helps identify OWLib entity markers
   * for spawn point calibration.
   */
  debugMarkers?: boolean
}

// ── Blender scene documentation ───────────────────────────────────────────────

export interface BlenderCollection {
  /** Collection name as it appears in Blender's Scene Collection panel. */
  name: string
  /**
   * Role of this collection in the map:
   * - playable: walkable architecture — included in physics + terrain sampler
   * - background: out-of-bounds scenery — excluded from physics
   * - lighting: lights and probes — not exported as meshes
   * - effects: visual FX volumes (fog, water) — excluded from physics
   * - entities: OW game object nodes (health packs, spawn volumes) — keep in terrain
   * - unknown: needs investigation
   */
  role: 'playable' | 'background' | 'lighting' | 'effects' | 'entities' | 'unknown'
  /** Total Blender objects in collection (direct children). */
  objects: number
  /** OWLib armature (model) instance count (subset of objects). */
  skeletonInstances?: number
  /**
   * Unique OWLib model IDs whose instances appear in this collection.
   * Format: bare hex string, e.g. '000000002695'.
   * Same model ID can appear in multiple collections.
   */
  modelIds?: string[]
  /**
   * Mesh hash strings exclusive to this collection (appear in Submesh_N.HASH.NNN names).
   * Used to build physics exclude patterns without re-exporting the GLB.
   */
  exclusiveMeshHashes?: string[]
  notes?: string
  children?: BlenderCollection[]
}

export interface BlenderScene {
  /**
   * Blender collection hierarchy extracted via headless Blender + Python script.
   * Collection names do NOT survive GLB export as nodes — this is documentation only.
   * Use exclusiveMeshHashes to derive runtime physicsFilter patterns.
   */
  collections: BlenderCollection[]
}

// ── Data form (human-authored, JSON-serializable, OW-vocabulary) ──────────────

export interface SpawnPoint {
  /** Human-readable label for debugging and calibration tooling. */
  label: string
  /** World-space X coordinate. Floor Y is sampled at runtime via raycasting. */
  x: number
  /** World-space Z coordinate. */
  z: number
}

/**
 * Serialisable descriptor for an OW arena GLB.
 * Uses OWLib terminology for materials and entity types.
 * Convert to the runtime form via {@link compileMapDescriptor}.
 *
 * Adding a new OW map:
 *   1. Create src/maps/<name>.ts  — define MapDescriptorData + call compileMapDescriptor()
 *   2. Add one entry to src/arenas/registry.ts
 */
export interface MapDescriptorData {
  /** Route-safe slug matching the ArenaEntry id in registry.ts. */
  id: string
  /** Display name (may include non-ASCII characters). */
  name: string
  /** Path to the GLB file under /public, e.g. '/maps/chateau-guillard.glb'. */
  glbUrl: string
  /**
   * Candidate player spawn positions with calibration labels.
   * One is chosen randomly each mount; floor Y is sampled at runtime.
   */
  spawnPoints: SpawnPoint[]
  /** Used when spawnPoints is empty or as a documented fallback coordinate. */
  spawnFallback: { x: number; z: number }
  physics: {
    /**
     * Regex patterns (case-insensitive) tested against mesh.name.
     * Any match → mesh excluded from Rapier trimesh and terrain sampler.
     * Mountain hashes can be expressed as '\\.HASH\\.' since they appear in
     * the Submesh_N.HASH.NNN naming convention.
     */
    excludeNamePatterns?: string[]
  }
  owlib: {
    /**
     * OWLib material name format: "<MapName>:<TypeCode>_<MeshHash>"
     * TypeCode is a hex integer identifying the material category.
     * Codes listed here tag non-architectural volumes (triggers, effects,
     * sound zones, lighting volumes) that should be hidden visually.
     * Matched meshes are kept in the terrain sampler for floor-Y grounding.
     */
    hiddenTypeCodes: string[]
    /**
     * Annotation of OWLib entity IDs found in the GLB scene graph.
     * Node names follow the pattern "Entity <HexId>.<InstanceNum>".
     * Key: bare hex ID (e.g. '0345'), value: human-readable role.
     * Used as documentation; not consumed at runtime.
     */
    entityTypes?: Record<string, string>
  }
  /**
   * Blender scene hierarchy, extracted via headless Blender script.
   * Purely documentation — collection names do not survive GLB export.
   */
  blenderScene?: BlenderScene
  /**
   * Dev flag: render green spheres at every ≤8-tri mesh node and log world
   * positions to console.debug.  Helps calibrate spawn points in-game.
   */
  debugMarkers?: boolean
}

// ── Compiler ──────────────────────────────────────────────────────────────────

/**
 * Compiles a human-authored {@link MapDescriptorData} into the runtime
 * {@link MapDescriptor} consumed by DboxSceneModule.
 * Pre-compiles all regex patterns so they are not recreated per-mesh.
 */
export function compileMapDescriptor(data: MapDescriptorData): MapDescriptor {
  const patterns = (data.physics.excludeNamePatterns ?? [])
    .map(p => new RegExp(p, 'i'))

  const physicsFilter = patterns.length > 0
    ? (mesh: THREE.Mesh) => !patterns.some(re => re.test(mesh.name))
    : undefined

  const techMatRe = data.owlib.hiddenTypeCodes.length > 0
    ? new RegExp(`\\b(${data.owlib.hiddenTypeCodes.join('|')})_`)
    : undefined

  return {
    glbUrl: data.glbUrl,
    spawnX: data.spawnFallback.x,
    spawnZ: data.spawnFallback.z,
    spawnPoints: data.spawnPoints.map(p => [p.x, p.z]),
    physicsFilter,
    owlibTechMat: techMatRe,
    debugMarkers: data.debugMarkers,
  }
}
