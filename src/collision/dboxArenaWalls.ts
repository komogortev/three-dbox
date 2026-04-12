import * as THREE from 'three'
import type { WallPlane, WallBox } from './WallCollider'

// ─── Arena layout constants ─────────────────────────────────────────────────

/** Arena boundary half-size (m). 80×80m arena centred at origin. */
const ARENA_HALF = 40
/** Wall visual height (m). */
const WALL_HEIGHT = 6
/** Wall visual thickness (m) — visual only, collision is plane-based. */
const WALL_THICKNESS = 0.3
/** Pillar half-size (m). */
const PILLAR_HALF = 1.5

// ─── Boundary walls (4 planes, normals face inward) ─────────────────────────

export const DBOX_ARENA_WALLS: WallPlane[] = [
  // North wall (at +Z edge, normal faces -Z = inward)
  { px: 0, pz: ARENA_HALF, nx: 0, nz: -1 },
  // South wall (at -Z edge, normal faces +Z = inward)
  { px: 0, pz: -ARENA_HALF, nx: 0, nz: 1 },
  // East wall (at +X edge, normal faces -X = inward)
  { px: ARENA_HALF, pz: 0, nx: -1, nz: 0 },
  // West wall (at -X edge, normal faces +X = inward)
  { px: -ARENA_HALF, pz: 0, nx: 1, nz: 0 },

  // ── Interior angled walls for slide testing ───────────────────────────────
  // NE corner — 45° wall segment (slides punch toward east or north)
  {
    px: 28, pz: 28,
    nx: -Math.SQRT1_2, nz: -Math.SQRT1_2,
  },
  // SW corner — 45° wall segment (slides punch toward west or south)
  {
    px: -28, pz: -28,
    nx: Math.SQRT1_2, nz: Math.SQRT1_2,
  },
  // Mid-west — 30° angled wall (shallow angle = longer slide)
  {
    px: -20, pz: 0,
    nx: Math.cos(Math.PI / 6), nz: Math.sin(Math.PI / 6), // 30° from X axis
  },
]

// ─── Interior boxes (pillars) ───────────────────────────────────────────────

export const DBOX_ARENA_BOXES: WallBox[] = [
  // Centre pillar
  {
    minX: -PILLAR_HALF, maxX: PILLAR_HALF,
    minZ: -PILLAR_HALF, maxZ: PILLAR_HALF,
  },
  // East pillar
  {
    minX: 18 - PILLAR_HALF, maxX: 18 + PILLAR_HALF,
    minZ: -PILLAR_HALF, maxZ: PILLAR_HALF,
  },
]

// ─── Visual meshes ──────────────────────────────────────────────────────────

const WALL_COLOR = 0x334155
const WALL_EMISSIVE = 0x1e293b
const PILLAR_COLOR = 0x475569
const PILLAR_EMISSIVE = 0x1e293b
const ANGLED_WALL_COLOR = 0x0e7490
const ANGLED_WALL_EMISSIVE = 0x083344

function wallMaterial(color: number, emissive: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.3,
    roughness: 0.7,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  })
}

/**
 * Build Three.js meshes for arena walls. Add returned objects to the scene.
 * Returns a flat array; caller is responsible for cleanup on unmount.
 */
export function buildArenaWallMeshes(): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = []

  // ── Boundary walls (4 thin box meshes) ──────────────────────────────────
  const mat = wallMaterial(WALL_COLOR, WALL_EMISSIVE)
  const wire = new THREE.LineBasicMaterial({ color: 0x64748b })
  const size = ARENA_HALF * 2

  const addBoundaryWall = (
    width: number, depth: number,
    px: number, pz: number,
  ): void => {
    const geo = new THREE.BoxGeometry(width, WALL_HEIGHT, depth)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(px, WALL_HEIGHT / 2, pz)
    mesh.receiveShadow = true
    meshes.push(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wire)
    edges.position.copy(mesh.position)
    meshes.push(edges)
  }

  // North & south
  addBoundaryWall(size, WALL_THICKNESS, 0, ARENA_HALF)
  addBoundaryWall(size, WALL_THICKNESS, 0, -ARENA_HALF)
  // East & west
  addBoundaryWall(WALL_THICKNESS, size, ARENA_HALF, 0)
  addBoundaryWall(WALL_THICKNESS, size, -ARENA_HALF, 0)

  // ── Angled walls (visual slabs) ─────────────────────────────────────────
  const angledMat = wallMaterial(ANGLED_WALL_COLOR, ANGLED_WALL_EMISSIVE)

  const addAngledWall = (
    px: number, pz: number,
    nx: number, nz: number,
    length: number,
  ): void => {
    const geo = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS)
    const mesh = new THREE.Mesh(geo, angledMat)
    mesh.position.set(px, WALL_HEIGHT / 2, pz)
    // Rotate to align perpendicular to normal
    mesh.rotation.y = Math.atan2(nx, nz)
    mesh.receiveShadow = true
    meshes.push(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wire)
    edges.position.copy(mesh.position)
    edges.rotation.copy(mesh.rotation)
    meshes.push(edges)
  }

  // NE 45° wall — 10m long
  addAngledWall(28, 28, -Math.SQRT1_2, -Math.SQRT1_2, 10)
  // SW 45° wall — 10m long
  addAngledWall(-28, -28, Math.SQRT1_2, Math.SQRT1_2, 10)
  // Mid-west 30° wall — 12m long
  addAngledWall(-20, 0, Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 12)

  // ── Pillars (box meshes) ────────────────────────────────────────────────
  const pillarMat = wallMaterial(PILLAR_COLOR, PILLAR_EMISSIVE)
  for (const box of DBOX_ARENA_BOXES) {
    const w = box.maxX - box.minX
    const d = box.maxZ - box.minZ
    const geo = new THREE.BoxGeometry(w, WALL_HEIGHT, d)
    const mesh = new THREE.Mesh(geo, pillarMat)
    mesh.position.set(
      (box.minX + box.maxX) / 2,
      WALL_HEIGHT / 2,
      (box.minZ + box.maxZ) / 2,
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wire)
    edges.position.copy(mesh.position)
    meshes.push(edges)
  }

  return meshes
}
