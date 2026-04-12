/**
 * Wall collision primitives and resolution math.
 * All operations are 2D (XZ plane) — Y is handled by terrain sampling.
 */

// ─── Geometry types ─────────────────────────────────────────────────────────

/** Infinite wall plane defined by a point and outward normal. */
export interface WallPlane {
  /** A point on the wall (XZ). */
  px: number
  pz: number
  /** Outward-facing unit normal. */
  nx: number
  nz: number
}

/** Axis-aligned solid box (pillar, thick wall segment). */
export interface WallBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// ─── Resolution results ─────────────────────────────────────────────────────

export interface CollisionResult {
  /** Corrected position (pushed out of wall). */
  x: number
  z: number
  /** Wall outward normal at contact. */
  nx: number
  nz: number
  /** Penetration depth (positive = inside wall). */
  penetration: number
}

// ─── Point vs plane ─────────────────────────────────────────────────────────

/**
 * Check if a circle (player) penetrates a wall plane.
 * Returns corrected position + normal, or `null` if no penetration.
 */
export function resolveCircleVsPlane(
  x: number,
  z: number,
  radius: number,
  wall: WallPlane,
): CollisionResult | null {
  // Signed distance from point to plane (positive = on normal side)
  const dx = x - wall.px
  const dz = z - wall.pz
  const dist = dx * wall.nx + dz * wall.nz

  if (dist >= radius) return null // no penetration

  const penetration = radius - dist
  return {
    x: x + wall.nx * penetration,
    z: z + wall.nz * penetration,
    nx: wall.nx,
    nz: wall.nz,
    penetration,
  }
}

// ─── Point vs box ───────────────────────────────────────────────────────────

/**
 * Check if a circle (player) penetrates an AABB box.
 * Pushes out along the axis of least penetration.
 * Returns corrected position + normal, or `null` if no penetration.
 */
export function resolveCircleVsBox(
  x: number,
  z: number,
  radius: number,
  box: WallBox,
): CollisionResult | null {
  // Expand box by radius for circle-vs-AABB
  const eMinX = box.minX - radius
  const eMaxX = box.maxX + radius
  const eMinZ = box.minZ - radius
  const eMaxZ = box.maxZ + radius

  if (x <= eMinX || x >= eMaxX || z <= eMinZ || z >= eMaxZ) return null

  // Find axis of least penetration
  const penLeft = x - eMinX
  const penRight = eMaxX - x
  const penBack = z - eMinZ
  const penFront = eMaxZ - z

  const minPen = Math.min(penLeft, penRight, penBack, penFront)

  if (minPen === penLeft) {
    return { x: eMinX, z, nx: -1, nz: 0, penetration: penLeft }
  }
  if (minPen === penRight) {
    return { x: eMaxX, z, nx: 1, nz: 0, penetration: penRight }
  }
  if (minPen === penBack) {
    return { x, z: eMinZ, nx: 0, nz: -1, penetration: penBack }
  }
  return { x, z: eMaxZ, nx: 0, nz: 1, penetration: penFront }
}

// ─── Slide velocity ─────────────────────────────────────────────────────────

/** Angle (radians) between velocity and wall normal. 0 = head-on, π/2 = parallel. */
function incidenceAngle(vx: number, vz: number, nx: number, nz: number): number {
  const speed = Math.hypot(vx, vz)
  if (speed < 1e-6) return 0
  // dot(velocity, -normal) / speed = cos(angle between velocity and inward normal)
  const cosAngle = (-vx * nx + -vz * nz) / speed
  return Math.acos(Math.min(1, Math.max(-1, cosAngle)))
}

/**
 * Compute post-collision carry velocity (slide along wall).
 *
 * - Head-on (< headOnAngle from normal): full stop
 * - Glancing: subtract normal component, apply friction
 */
export function computeSlideVelocity(
  carryVx: number,
  carryVz: number,
  normalX: number,
  normalZ: number,
  friction = 0.15,
  headOnAngleRad = Math.PI / 6, // 30°
): { vx: number; vz: number } {
  const speed = Math.hypot(carryVx, carryVz)
  if (speed < 1e-4) return { vx: 0, vz: 0 }

  const angle = incidenceAngle(carryVx, carryVz, normalX, normalZ)

  // Head-on: full stop
  if (angle < headOnAngleRad) {
    return { vx: 0, vz: 0 }
  }

  // Remove normal component: slide = v - dot(v, n) * n
  const dot = carryVx * normalX + carryVz * normalZ
  let slideVx = carryVx - dot * normalX
  let slideVz = carryVz - dot * normalZ

  // Apply friction (speed reduction on slide)
  const slideFactor = 1 - friction
  slideVx *= slideFactor
  slideVz *= slideFactor

  return { vx: slideVx, vz: slideVz }
}
