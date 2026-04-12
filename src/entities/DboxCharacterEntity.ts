import type { PlayerController } from '@base/player-three'
import type {
  WallPlane,
  WallBox,
  CollisionResult,
} from '../collision'
import {
  resolveCircleVsPlane,
  resolveCircleVsBox,
  computeSlideVelocity,
} from '../collision'

/** Minimum carry speed (m/s) below which collision resolve is skipped. */
const CARRY_THRESHOLD = 0.5
/** Player collision radius (metres). */
const PLAYER_RADIUS = 0.4
/** Slide friction — fraction of speed lost on wall contact. */
const SLIDE_FRICTION = 0.12
/** Head-on angle threshold (radians). Impacts within this angle from normal = full stop. */
const HEAD_ON_ANGLE = Math.PI / 6 // 30°

/**
 * Character entity for the Doomfist champion — correction layer over PlayerController.
 *
 * Responsibilities:
 * - Owns wall collision geometry references
 * - After each gameplay tick, checks player position against walls
 * - Corrects position (push-out) and carry velocity (slide) when penetrating
 *
 * Does NOT own abilities (DboxLab handles those and injects carry velocity directly).
 * Future: abilities migrate into this entity.
 */
export class DboxCharacterEntity {
  private walls: WallPlane[] = []
  private boxes: WallBox[] = []

  constructor(
    private readonly getController: () => PlayerController,
    private readonly getCharacter: () => THREE.Object3D,
  ) {}

  /** Register arena collision geometry. */
  setCollisionGeometry(walls: WallPlane[], boxes: WallBox[]): void {
    this.walls = walls
    this.boxes = boxes
  }

  /** Expose walls for blob NPC collision in DboxLab. */
  getWalls(): WallPlane[] { return this.walls }
  getBoxes(): WallBox[] { return this.boxes }

  /**
   * Post-tick collision correction.
   * Call from `onAfterGameplayTick` — after PlayerController has moved the character.
   */
  resolveCollision(): void {
    const controller = this.getController()
    const character = this.getCharacter()
    const carry = controller.getPlanarCarryVelocity()

    // Only resolve when carry velocity is significant (abilities in flight).
    // Normal walking collision is handled separately (simple position clamp).
    const carrySpeed = Math.hypot(carry.x, carry.z)
    const hasCarry = carrySpeed > CARRY_THRESHOLD

    const px = character.position.x
    const pz = character.position.z
    let cx = px
    let cz = pz
    let corrected = false
    let slideNx = 0
    let slideNz = 0

    // Check all wall planes
    for (const wall of this.walls) {
      const hit = resolveCircleVsPlane(cx, cz, PLAYER_RADIUS, wall)
      if (hit) {
        cx = hit.x
        cz = hit.z
        slideNx = hit.nx
        slideNz = hit.nz
        corrected = true
      }
    }

    // Check all wall boxes
    for (const box of this.boxes) {
      const hit = resolveCircleVsBox(cx, cz, PLAYER_RADIUS, box)
      if (hit) {
        cx = hit.x
        cz = hit.z
        slideNx = hit.nx
        slideNz = hit.nz
        corrected = true
      }
    }

    if (!corrected) return

    // Apply position correction
    character.position.x = cx
    character.position.z = cz
    controller.syncPosition(cx, character.position.y, cz)

    // Apply carry velocity slide (only meaningful during ability travel)
    if (hasCarry) {
      const slide = computeSlideVelocity(
        carry.x,
        carry.z,
        slideNx,
        slideNz,
        SLIDE_FRICTION,
        HEAD_ON_ANGLE,
      )
      controller.setPlanarCarryVelocity(slide.vx, slide.vz)
    }
  }

  /**
   * Walking collision — simpler than carry resolve.
   * Prevents walking through walls even without carry velocity.
   */
  resolveWalkingCollision(): void {
    const character = this.getCharacter()
    const controller = this.getController()
    let cx = character.position.x
    let cz = character.position.z
    let corrected = false

    for (const wall of this.walls) {
      const hit = resolveCircleVsPlane(cx, cz, PLAYER_RADIUS, wall)
      if (hit) {
        cx = hit.x
        cz = hit.z
        corrected = true
      }
    }

    for (const box of this.boxes) {
      const hit = resolveCircleVsBox(cx, cz, PLAYER_RADIUS, box)
      if (hit) {
        cx = hit.x
        cz = hit.z
        corrected = true
      }
    }

    if (corrected) {
      character.position.x = cx
      character.position.z = cz
      controller.syncPosition(cx, character.position.y, cz)
    }
  }
}
