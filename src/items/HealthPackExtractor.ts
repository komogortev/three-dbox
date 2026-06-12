import type * as THREE from 'three'
import type { HealthPackSlotDef } from '@/maps/MapDescriptor'
import { extractEntityNodes } from '@/maps/entityScan'

export interface ExtractedSlot {
  group: string
  entityType: string
  instance: number
  size: 'small' | 'large'
  /** World-space position read from the OWLib entity EMPTY node. */
  position: THREE.Vector3
}

/**
 * Traverse a loaded OW GLB scene and extract all health pack positions for the
 * given slot definitions.  Returns one `ExtractedSlot` per matching entity node.
 * Node matching follows the OWLib entity naming convention — see
 * {@link extractEntityNodes} in maps/entityScan.ts.
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

  const nodes = extractEntityNodes(root, [...byType.keys()])
  const results: ExtractedSlot[] = nodes.map(n => {
    const def = byType.get(n.entityType)!
    return {
      group: def.group,
      entityType: def.entityType,
      instance: n.instance,
      size: def.size,
      position: n.position,
    }
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
