import * as THREE from 'three'

/** One OWLib entity node found in a loaded OW map GLB. */
export interface EntityNode {
  /** 4-hex OWLib entity type ID, uppercased (e.g. '37C2'). */
  entityType: string
  /** Instance number within the type (parsed from the trailing 3 digits). */
  instance: number
  /** World-space position of the entity node. */
  position: THREE.Vector3
}

/**
 * OWLib entity node naming — two families observed in the Château Guillard GLB
 * (raw JSON names; Three.js sanitizeNodeName turns spaces into "_" and strips
 * dots at load, which is the form this regex matches):
 *
 *   Item markers:        "0000000037C2.001"        → "0000000037C2001"
 *   Pure-EMPTY entities: "Entity 000000000345.001" → "Entity_000000000345001"
 *
 * Both families nest as <id>_WRAP.<n> (carries the translation) → inner node
 * (carries the Z-up→Y-up rotation only) — we match the INNER node and let
 * getWorldPosition compose the WRAP transform.  "_WRAP"/"_COLLECTION" names
 * fail the trailing-digits anchor, so each instance matches exactly once.
 * Item-marker types additionally carry ≤8-tri mesh children; pure EMPTYs
 * (e.g. 0345 spawn volumes) have none, so mesh-based surveys (debugMarkers
 * ≤8-tri pass) cannot see them — this name-scan can.
 */
export const ENTITY_NODE_RE = /^(?:Entity_)?00000000([0-9A-Fa-f]{4})(\d{3})$/

/**
 * Traverse a loaded OW GLB scene and return every OWLib entity node, optionally
 * filtered to a set of 4-hex type IDs (case-insensitive).
 *
 * Pass `types` whenever possible — Château Guillard alone has ~5476 entity
 * EMPTYs, so unfiltered results are only useful for exploratory surveys.
 *
 * Caller must ensure world transforms are current, e.g. via
 * `root.updateWorldMatrix(true, true)` after `scene.add(root)`.
 */
export function extractEntityNodes(root: THREE.Object3D, types?: string[]): EntityNode[] {
  const wanted = types ? new Set(types.map(t => t.toUpperCase())) : null

  const results: EntityNode[] = []
  const pos = new THREE.Vector3()

  root.traverse(node => {
    const m = node.name.match(ENTITY_NODE_RE)
    if (!m) return
    const type = m[1].toUpperCase()
    if (wanted && !wanted.has(type)) return
    node.getWorldPosition(pos)
    results.push({
      entityType: type,
      instance: parseInt(m[2], 10),
      position: pos.clone(),
    })
  })

  return results
}
