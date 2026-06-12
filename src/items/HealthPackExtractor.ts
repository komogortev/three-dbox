import * as THREE from 'three'
import type { HealthPackSlotDef } from '@/maps/MapDescriptor'

export interface ExtractedSlot {
  group: string
  entityType: string
  instance: number
  size: 'small' | 'large'
  /** World-space position read from the OWLib entity EMPTY node. */
  position: THREE.Vector3
}

/**
 * OWLib entity node naming convention (observed in Château Guillard GLB):
 *   00000000<TypeHex4><Instance3>
 * e.g. "0000000037C2001" → type "37C2", instance 1
 *
 * Three.js GLTFLoader imports OWLib EMPTY nodes as Object3D with the entity
 * node name.  Their ≤8-tri marker mesh children carry "Submesh_HASH.N" names.
 * We match on the parent Object3D, not the child mesh.
 */
const ENTITY_RE = /^00000000([0-9A-Fa-f]{4})(\d{3})$/i

/**
 * Traverse a loaded OW GLB scene and extract all health pack positions for the
 * given slot definitions.  Returns one `ExtractedSlot` per matching entity node.
 *
 * Call after `scene.add(mapRoot)` and `mapRoot.updateWorldMatrix(true, true)`
 * so world transforms are current.
 */
export function extractHealthPackSlots(
  root: THREE.Object3D,
  slotDefs: HealthPackSlotDef[],
): ExtractedSlot[] {
  const byType = new Map<string, HealthPackSlotDef>()
  for (const def of slotDefs) byType.set(def.entityType.toUpperCase(), def)

  const results: ExtractedSlot[] = []
  const pos = new THREE.Vector3()

  root.traverse(node => {
    const m = node.name.match(ENTITY_RE)
    if (!m) return
    const type = m[1].toUpperCase()
    const def = byType.get(type)
    if (!def) return
    node.getWorldPosition(pos)
    results.push({
      group: def.group,
      entityType: def.entityType,
      instance: parseInt(m[2], 10),
      size: def.size,
      position: pos.clone(),
    })
  })

  results.sort(
    (a, b) =>
      a.group.localeCompare(b.group) ||
      a.entityType.localeCompare(b.entityType) ||
      a.instance - b.instance,
  )

  console.debug(
    `[HealthPackExtractor] ${results.length} slots extracted:`,
    results.map(
      s =>
        `${s.group}/${s.entityType}-${s.instance} ` +
        `(${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)}, ${s.position.z.toFixed(1)})`,
    ),
  )

  return results
}
