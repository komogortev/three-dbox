import type * as THREE from 'three'

/**
 * Per-map configuration for DboxSceneModule.
 * Centralises spawn point, physics filter, and OWLib visual cleanup per arena —
 * so map-specific constants no longer live inside onMount().
 */
export interface MapDescriptor {
  /** Path to the GLB file under /public, e.g. '/maps/chateau-guillard.glb'. */
  glbUrl: string
  /** Player spawn X coordinate (floor Y is sampled at load-time). */
  spawnX: number
  /** Player spawn Z coordinate. */
  spawnZ: number
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
}
