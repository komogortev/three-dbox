import * as THREE from 'three'
import type { ExtractedSlot } from './HealthPackExtractor'

const SMALL_HP = 25
const LARGE_HP = 150
const RESPAWN_SECONDS = 30
const PICKUP_RADIUS = 1.5
/** How far above the entity node's Y to float the visual mesh. */
const FLOAT_OFFSET_Y = 0.9

/** Small packs: bright green; large packs: white. */
const COLOR_SMALL = 0x44ff77
const COLOR_LARGE = 0xffffff

interface LivePack {
  slot: ExtractedSlot
  mesh: THREE.Mesh
  /** Seconds remaining on cooldown.  0 = available for pickup. */
  cooldown: number
}

/**
 * Manages the lifecycle of health pack pickups for one map session.
 *
 * Pipeline:
 *   extractHealthPackSlots() → ExtractedSlot[]
 *     → HealthPackManager(slots, rotations)
 *       → .mount(scene, rotationIndex)   — activates subset, spawns visual meshes
 *       → .tick(playerPos, dt)           — pickup detection + cooldown advance
 *       → .unmount()                     — dispose geometry + materials
 *
 * Rotation index is advanced by DboxSceneModule.spawnCount so each visit to the
 * map cycles to the next layout in the descriptor's `rotations` array.
 */
export class HealthPackManager {
  private live: LivePack[] = []
  private readonly rotations: string[][] | null

  constructor(
    private readonly slots: ExtractedSlot[],
    /** Ordered rotation layouts; each entry = set of group names active that spawn.
     *  null or [] → all slots active on every spawn. */
    rotations: string[][] | null,
  ) {
    // Normalise empty array to null so modulo logic never divides by zero.
    this.rotations = rotations?.length ? rotations : null
  }

  mount(scene: THREE.Scene, rotationIndex: number): void {
    const activeGroups = this.rotations
      ? new Set(this.rotations[rotationIndex % this.rotations.length])
      : null

    for (const slot of this.slots) {
      if (activeGroups && !activeGroups.has(slot.group)) continue
      const mesh = this.makeMesh(slot)
      scene.add(mesh)
      this.live.push({ slot, mesh, cooldown: 0 })
    }

    console.debug(
      `[HealthPackManager] ${this.live.length}/${this.slots.length} packs active` +
        ` (rotation ${rotationIndex}` +
        (this.rotations
          ? ` → [${this.rotations[rotationIndex % this.rotations.length].join(', ')}]`
          : ' → all') +
        ')',
    )
  }

  /**
   * Advance cooldown timers and detect pickups.
   * @returns HP to add to the player this tick (0 if no pickup occurred).
   */
  tick(playerPos: THREE.Vector3, dt: number): number {
    let hpGain = 0

    for (const pack of this.live) {
      if (pack.cooldown > 0) {
        pack.cooldown = Math.max(0, pack.cooldown - dt)
        if (pack.cooldown <= 0) pack.mesh.visible = true
        continue
      }
      if (pack.mesh.visible && pack.slot.position.distanceTo(playerPos) < PICKUP_RADIUS) {
        hpGain += pack.slot.size === 'small' ? SMALL_HP : LARGE_HP
        pack.mesh.visible = false
        pack.cooldown = RESPAWN_SECONDS
        console.debug(
          `[HealthPackManager] picked up ${pack.slot.group}/${pack.slot.entityType}-${pack.slot.instance}` +
            ` (+${pack.slot.size === 'small' ? SMALL_HP : LARGE_HP} HP, respawn in ${RESPAWN_SECONDS}s)`,
        )
      }
    }

    return hpGain
  }

  unmount(): void {
    for (const { mesh } of this.live) {
      mesh.parent?.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.live = []
  }

  private makeMesh(slot: ExtractedSlot): THREE.Mesh {
    const radius = slot.size === 'small' ? 0.22 : 0.36
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshBasicMaterial({
        color: slot.size === 'small' ? COLOR_SMALL : COLOR_LARGE,
      }),
    )
    mesh.position.copy(slot.position)
    mesh.position.y += FLOAT_OFFSET_Y
    return mesh
  }
}
