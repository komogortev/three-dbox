import type { SceneDescriptor } from '@base/scene-builder'
import { sandboxScene } from './sandbox'

/**
 * Doomfist armored mesh (Trinity export, Draco + WebP via gltf-transform).
 * Origin at feet, Armature root with proper skeleton — skinning works with
 * SceneBuilder's modelFitHeight + alignFeet pipeline.
 *
 * Decimated 2026-06-13 (EX-1.5): 960,108 → 38,404 tris via gltf-transform
 * `weld` + `simplify --ratio 0.04 --error 0.01`, then re-Draco. The raw Tripo
 * export was ~73% of total scene geometry — EX-1's #1 perf finding. Skin
 * weights + joints preserved (40-bone skeleton, mixer-verified live); local
 * bbox height 1.0 unchanged so modelFitHeight scaling is unaffected. If the
 * mesh is ever re-decimated, re-verify rig + locomotion clips deform cleanly.
 *
 * IMPORTANT: Do NOT use `--compress meshopt` for skinned GLBs.
 * `KHR_mesh_quantization` (i16_norm positions) breaks GPU skinning because
 * position normalization to [-1,1] mismatches the inverse bind matrices.
 * Use `--compress draco` instead — it compresses geometry without
 * renormalizing vertex positions.
 */
const DFIST_BASE_GLB = encodeURI('/models/dfist_base.glb')

/**
 * Locomotion dev box — same physics fixtures as {@link sandboxScene}, distinct
 * descriptor identity so logs / volumes / future per-scene tuning do not collide.
 */
export const dboxScene: SceneDescriptor = (() => {
  const d = structuredClone(sandboxScene) as SceneDescriptor
  const vols = d.swimmableVolumes
  if (vols?.[0]) vols[0].label = 'dbox-pool'

  const base = sandboxScene.character
  d.character = {
    startPosition: base?.startPosition ?? [0, 30],
    modelUrl: DFIST_BASE_GLB,
    // OW1 Doomfist ≈ 7 ft (2.1 m). Raw GLB is ~1.0 m; modelFitHeight scales to match.
    modelFitHeight: 2.1,
    pruneExtraSkinnedMeshes: true,
    rotationY: base?.rotationY ?? Math.PI / 2,
    terrainFootprintRadius: 0.22,
    // Harness-owned copy of the shared GLB locomotion pack.
    animationClipUrls: ['/characters/npc/animations_base.glb'],
    locomotionClipIndices: { idleStand: 4, walkFwdStand: 6, runFwdStand: 3 },
  }

  return d
})()
