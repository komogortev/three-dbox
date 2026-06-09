import type * as THREE from 'three'

/**
 * Per-map configuration for DboxSceneModule.
 * Centralises spawn point, physics filter, and OWLib visual cleanup per arena —
 * so map-specific constants no longer live inside onMount().
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
   * each mount instead of spawnX/spawnZ.  Floor Y is still sampled at runtime.
   */
  spawnPoints?: [number, number][]
  /**
   * Return false to exclude a Mesh from Rapier trimesh and terrain sampler.
   * Defaults to including all meshes when omitted.
   */
  physicsFilter?: (mesh: THREE.Mesh) => boolean
  /**
   * Regex matching OWLib technical material-name prefixes.
   * Matching meshes are hidden visually at load but kept in the terrain sampler
   * (≤8-tri spawn/trigger quads need floor-Y sampling).
   */
  owlibTechMat?: RegExp
  /**
   * Dev flag: render a visible green sphere at every ≤8-triangle mesh node and
   * log its world position to console.debug.  Helps identify OWLib entity markers
   * (health packs, spawn volumes, triggers) for spawn point calibration.
   */
  debugMarkers?: boolean
}
