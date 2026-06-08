import * as THREE from 'three'
import type { TerrainSurfaceSampler } from '@base/player-three'

/**
 * Mesh-based terrain sampler — replaces the procedural `TerrainSampler` with
 * exact geometry from a loaded GLB collision mesh.
 *
 * Uses downward raycasting (Y=500 → Y=-∞) against a pre-collected flat list of
 * mesh objects. The collision GLB must already be added to the scene and have its
 * `matrixWorld` updated before this sampler is used.
 *
 * Limitation: top-down raycasting cannot sample the face of near-vertical surfaces
 * (steep hills, walls). Use `fallback` to provide a secondary sampler (e.g. the
 * procedural TerrainSampler) that handles missed positions gracefully.
 *
 * Performance: ~5 raycasts per frame (PlayerController footprint pattern).
 * For a simplified collision mesh (~10–50k triangles), Three.js native raycasting
 * is sufficient. Add `three-mesh-bvh` if frame budget tightens on complex geometry.
 */
export class MeshTerrainSampler implements TerrainSurfaceSampler {
  private readonly raycaster: THREE.Raycaster
  private readonly origin = new THREE.Vector3()
  private static readonly DOWN = new THREE.Vector3(0, -1, 0)
  private readonly meshes: THREE.Mesh[]
  private readonly fallback: TerrainSurfaceSampler | null

  private readonly probeFromY: number | (() => number)

  /**
   * @param meshes      Pre-collected mesh objects from the collision GLB.
   * @param fallback    Optional secondary sampler used when the ray misses (returns 0).
   * @param probeFromY  World Y to cast the ray from. Default 500 (catches all geometry).
   *                    - Pass a number for a fixed probe origin.
   *                    - Pass a callback `() => number` for a dynamic (e.g. character-relative)
   *                      probe origin, evaluated fresh each `sample()` call. This is the correct
   *                      approach for multi-level geometry: probe from just above the character's
   *                      current position so the sampler always finds the floor they are on, not
   *                      a floor on a different level. The callback should return a Y that is:
   *                        • BELOW any ceiling the character could be standing under (so double-sided
   *                          ceiling faces are not detected as floor)
   *                        • ABOVE the floor surface the character is standing on
   *                      A typical value: `() => character.position.y - 0.5` (50 cm below capsule
   *                      centre, i.e. ~35 cm above the feet).
   */
  constructor(meshes: THREE.Mesh[], fallback: TerrainSurfaceSampler | null = null, probeFromY: number | (() => number) = 500) {
    this.meshes = meshes
    this.fallback = fallback
    this.probeFromY = probeFromY
    this.raycaster = new THREE.Raycaster(this.origin, MeshTerrainSampler.DOWN)
  }

  /**
   * Collect all Mesh objects from a GLB root for use as collision geometry.
   * Call after the root has been added to the scene and `updateMatrixWorld(true)` called.
   */
  static fromRoot(
    root: THREE.Object3D,
    fallback: TerrainSurfaceSampler | null = null,
  ): MeshTerrainSampler {
    const meshes: THREE.Mesh[] = []
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
    })
    return new MeshTerrainSampler(meshes, fallback)
  }

  /**
   * Returns world Y at (x, z) by casting a ray downward from probeFromY.
   * Falls back to the secondary sampler on a miss (steep slopes, off-mesh positions).
   */
  sample(x: number, z: number): number {
    const probeY = typeof this.probeFromY === 'function' ? this.probeFromY() : this.probeFromY
    this.origin.set(x, probeY, z)
    const hits = this.raycaster.intersectObjects(this.meshes, false)
    if (hits.length > 0) return hits[0].point.y
    return this.fallback ? this.fallback.sample(x, z) : 0
  }
}
