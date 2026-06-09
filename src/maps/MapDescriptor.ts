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
 *   1. Create src/maps/<name>.ts  ← define MapDescriptorData + export compileMapDescriptor(data)
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
     * Regex pattern (case-insensitive) for mesh names to exclude from Rapier
     * trimesh and the terrain sampler.  Typically targets OWLib rig visualisers
     * (smd_bone_vis) that would otherwise trap the player capsule.
     */
    excludeNamePattern?: string
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
   * Dev flag: render green spheres at every ≤8-tri mesh node and log world
   * positions to console.debug.  Helps calibrate spawn points in-game.
   */
  debugMarkers?: boolean
}

// ── Compiler ──────────────────────────────────────────────────────────────────

/**
 * Compiles a human-authored {@link MapDescriptorData} into the runtime
 * {@link MapDescriptor} consumed by DboxSceneModule.
 * Pre-compiles regex patterns so physicsFilter is not recreated per-mesh.
 */
export function compileMapDescriptor(data: MapDescriptorData): MapDescriptor {
  const physicsRe = data.physics.excludeNamePattern
    ? new RegExp(data.physics.excludeNamePattern, 'i')
    : null
  const techMatRe = data.owlib.hiddenTypeCodes.length > 0
    ? new RegExp(`\\b(${data.owlib.hiddenTypeCodes.join('|')})_`)
    : undefined

  return {
    glbUrl: data.glbUrl,
    spawnX: data.spawnFallback.x,
    spawnZ: data.spawnFallback.z,
    spawnPoints: data.spawnPoints.map(p => [p.x, p.z]),
    physicsFilter: physicsRe ? mesh => !physicsRe.test(mesh.name) : undefined,
    owlibTechMat: techMatRe,
    debugMarkers: data.debugMarkers,
  }
}
