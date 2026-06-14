# three-dbox — EX-1 Findings: Perf + Glitch Diagnosis

> **Session:** EX-1 (experience-floor sprint). **Date:** 2026-06-13. **Branch:** `feat/ex1-perf-diagnosis`.
> **Goal:** turn "it lags / it glitches" into numbers; bank the cheap renderer wins; size EX-2 and the draw-call decision.
> **Plan:** `PLAN-EX-EXPERIENCE-FLOOR-2026-06-12.md` §EX-1. **Sprint tracker:** `SPRINT-EX-V1.md`.

## TL;DR — the hypothesis was half right, and it pointed at the wrong fix

The pre-sprint guess was "~374 unbatched draw calls is the lag." Measurement says:

1. **The single biggest geometry cost is the player character mesh: `public/models/dfist_base.glb` = 960,108 triangles (≈73% of the entire scene's geometry).** It is an un-decimated Tripo export (`tripo_node_…` under `Armature`). A Doomfist model should be ~30–50K tris. **This is the #1 perf lever and it is an asset fix, not an engine fix.**
2. **Draw calls are 120–180 in typical views, peaking at 463 looking into the courtyard structure** — moderate, not catastrophic. The ~374 figure was a worst-view number, not idle.
3. **On the discrete dev GPU, render time is flat across pixel ratio 1/2/3 (~10.2–10.5 ms)** → this machine is **vertex/submit-bound, not fill-bound**. The uncapped-pixel-ratio lever bites on **fill-bound hardware** (integrated GPUs, hi-DPI laptops — the owner's likely lag source), not here.

**Net:** ship the pixel-ratio cap (done — cheap insurance), **prioritise a character-mesh decimation pass**, and **defer `BatchedMesh`** until the character is fixed and the 463-draw courtyard view still costs frames on target hardware.

---

## Method

- Live via the Claude preview dev server (`localhost:5175`), Château Guillard, `?perf=1&navdebug=1`.
- `?perf` registers a 1 Hz `renderer.info` + frame-time overlay and exposes a dev-only `window.__dboxPerf` handle (`renderer`/`scene`/`camera`). Measurements below were taken through that handle by forcing a correctly-sized `render()` and reading `renderer.info` — this is **independent of build mode and of the on-page canvas size**, so draw-call / triangle / program / memory figures are authoritative.
- **Caveats:** (a) numbers are from the **dev server on the dev machine** (`devicePixelRatio = 1`, discrete GPU). Absolute frame-time on a prod build / the owner's hardware will differ; **draw-call, triangle, program and memory counts are build-independent**. (b) The headless preview tab is unfocused → RAF is throttled, so the live overlay's fps figure is unreliable; render-time below is measured by timing N forced `render()` calls instead.

---

## EX-1.1 — Perf numbers

### Geometry census (Château Guillard, full scene)

| Metric | Value |
|---|---|
| Total meshes in scene | 457 |
| **Total scene triangles** | **~1.31 M** |
| — of which **player character** (`dfist_base.glb`, `tripo_node_*`) | **960,108 (73%)** |
| Largest *map* submesh | ~13 K tris (`Submesh_02478AD6…`, hidden) |
| Shader programs | 13 |
| GPU geometries / textures | 165 / **302** |

> The map itself is well-behaved: no single static hog, biggest map submesh ~13 K, and the two heaviest (~13 K each) are already `visible:false` via display overrides. The character mesh dwarfs everything.

### Draw-call / triangle envelope (360° yaw sweep at `yard-center` spawn)

| Facing | Draw calls | Triangles |
|---|---|---|
| 0° | 180 | 1.48 M |
| 45° | 423 | **3.02 M** |
| **90°** | **463** | 1.14 M |
| 135° | 361 | 1.06 M |
| 180° | 121 | 0.47 M |
| 225° | 112 | 0.45 M |
| 270° | 118 | 0.45 M |
| 315° | 148 | 1.44 M |

- **Draw calls:** 112 (looking away) → **463** (into the main structure). Typical play ≈ 150–250.
- **Triangles/frame:** 0.45 M → **3.02 M**. The high-triangle views are the ones that frame the character + the dense courtyard together.

### Terrain sampler (gameplay-tick CPU cost)

- `MeshTerrainSampler` raycasts against **456 meshes with no BVH**, ~5×/frame (PlayerController footprint). Per-raycast cost not micro-timed this session (no `THREE` global to instantiate a `Raycaster` through the handle), but 456-mesh broad-phase per cast, 5×/frame, is a flagged CPU cost. **`three-mesh-bvh` is the known mitigation** if the gameplay tick proves heavy after the character fix. Deferred — measure under real movement first.

---

## EX-1.2 — Renderer audit + quick wins

### Audit (engine defaults, logged at mount)

| Setting | Value before |
|---|---|
| `setPixelRatio` | **`window.devicePixelRatio` — UNCAPPED** (`ThreeModule.ts:42`) |
| `toneMapping` | `NoToneMapping` (0) |
| `toneMappingExposure` | 1 |
| `shadowMap.enabled` | `false` |

### Shipped (EX-1.2, dbox-local, unconditional)

- **Pixel-ratio cap:** `ctx.renderer.setPixelRatio(min(devicePixelRatio, 2))` in `DboxSceneModule.onMount` after super. `?pixelratio=N` overrides for owner A/B.
- `toneMapping` / `shadowMap` **left at defaults** and only logged — tuning them is EX-3's job (changing tone mapping now would be a visual regression before the dusk pass is designed).

### Empirical: is pixel ratio actually the lever?

Render-only ms/frame at the worst yaw (463 draws / ~1.1 M tris), 60 frames after warm-up, this machine:

| pixelRatio | ms/frame |
|---|---|
| 1 | 10.46 |
| 2 | 10.21 |
| 3 | 10.19 |

**Flat.** On a discrete GPU at 1280×720 this scene is **not fill-bound** — the cost is vertex/draw submission. So:

- The pixel-ratio cap is **correct and free here** (no visual regression: `dpr=1` → `min(1,2)=1`, no change at all on this display; it only ever *reduces* buffer resolution on `>2×` displays).
- Its **real payoff is on fill-bound hardware** — integrated GPUs and hi-DPI laptops, where uncapped `dpr` of 2–3 means 4–9× fragment work. That is the **most likely explanation for the owner's "lag,"** and the cap directly addresses it. We can't reproduce that here (dev display is `dpr=1`); owner should A/B `?pixelratio=3` vs default on their actual machine to confirm.

---

## EX-1.3 — Glitch instrumentation (feeds EX-2)

Shipped behind `?navdebug=1` (logs at 10 Hz + immediately on any single-tick |ΔY| > 0.25 m):

```
[dbox/nav] y=<finalY> dY=<perTick> floorY=<sampler> gap=<feet−floor>
           probeY=<probe origin> lift=<step lift> push=<wall push> xz=(x,z)
```

`DboxCharacterEntity` now records `lastStepLiftY` / `lastWallPushDepth` each `resolveWalkingCollision()` so the logger can attribute a pop to the lift that caused it.

### Confirmed by code (the two EX-2 root causes)

1. **Stair / doorway pops — probe-Y is wrong by contract.** The module passes the sampler `() => Math.max(character.position.y + 1.0, 1.0)` (`DboxSceneModule.ts:168`) — i.e. probe from **1 m *above* the capsule centre**. The sampler's own contract says probe from **below any ceiling the player is under, typically `character.y − 0.5`** (`MeshTerrainSampler.ts:38-43`). Probing from above means under a low lintel / on a stair under an overhang the downward ray can hit the **wrong surface (a ceiling face or the level above)** → the floor Y snaps to the wrong value → the pop. **EX-2.2 fix:** move toward the documented `y − 0.5` form, but keep a separate one-shot spawn probe for the drop-to-ground self-correction the `+1.0` was originally added for.
2. **Fall-through walls — `spherePenetration` is overlap-only.** Its docstring documents tunnelling "at >2×radius/tick." Rocket punch tops out at 152 m/s ≈ 2.5 m/frame vs player radius 0.4 m → it can clip fully through a thin wall in one tick. **EX-2.1 fix:** swept sphere cast (`shapeCastSphere` in `@base/physics`) above a speed threshold.

> Runtime nav-log capture (numbers during an actual stair pop) is **owner-playtest-ready** but not captured this session: the headless preview throttles RAF and FPS movement needs pointer-lock + sustained input that the preview tools can't drive reliably. The instrumentation is built, type-clean, and verified to mount; the owner (or EX-2's interactive session) produces the trace.

---

## EX-1.4 — Lighting baseline (data for EX-3)

Château inherits the **sandbox** atmosphere verbatim (`dboxScene = structuredClone(sandboxScene)`; `src/scenes/sandbox.ts:42-53`) — there is no per-map lighting field today:

```
dynamicSky:false  fogColor:0x111827  fogDensity:0.006
ambientColor:0x8899aa  ambientIntensity:1.2          ← high flat fill
hemisphereSky:0xc4d8f0 hemisphereGround:0x2d3748 hemisphereIntensity:0.7
time.initialPhase:0.25 (fixed NOON)  sunIntensity:1.4   ← bright overhead sun
toneMapping:NoToneMapping  exposure:1
```

That is precisely "over-bright calibration grid": **fixed noon + strong ambient fill + no tone mapping** = flat, shadowless, washed-out. **EX-3 target (dusk courtyard):** drop sun intensity + warm its colour + lower a courtyard angle; cut ambient/hemisphere fill; tune distance fog; likely `ACESFilmicToneMapping` + exposure for the highlight rolloff. (Screenshots not captured here — the config above is the actionable input; the headless canvas-collapse below blocks clean gameplay screenshots anyway.)

---

## Bonus finding — engine container collapses to 0×0 in headless (latent)

While instrumenting I hit a black screen: the engine container (`<div class="absolute inset-0">`) had its **computed position overridden to `relative` by an inline `style="position: relative"`** — the `@base/input` `TouchProvider` mount stamp. With `position:relative`, Tailwind's `inset-0` no longer sizes the element, so it **collapses to `height:0` → the renderer reads `clientHeight=0` → `0×0` canvas → black screen**. Forcing `position:absolute` back restored it to 720 px.

This is a **race**: if `ThreeModule` reads `clientHeight` *before* the canvas establishes a height, the container is already `position:relative` and reports 0. The owner's real browser evidently wins the race (they playtested a rendered scene); the headless preview loses it reliably. Memory records a 2026-06-02 fix to `TouchProvider`'s **unmount** restore — this is the **mount-side** sibling. **Not in EX-1 scope** (the cap/instrumentation are dbox-local; this lives in `@base/input` or in dbox's container styling), but it is a real robustness bug and a strong follow-up candidate.

> **Resolved 2026-06-13** (follow-up session). Fixed in `@base/input` `TouchProvider.mount()`: the old guard checked the **inline** `style.position` (empty for a class-positioned element, so it still stamped `relative`); it now checks the **computed** position — `if (getComputedStyle(container).position === 'static') container.style.position = 'relative'`. The overlay (`position:absolute; inset:0`) only needs a positioning context when the container has none; any container already `absolute`/`relative`/`fixed`/`sticky` is left untouched. Verified live on `/dbox?arena=chateau-guillard`: container stays computed `absolute` with no inline position, `clientHeight` 1295 px (was 0), canvas built non-zero (1111×1295), touch overlay still mounts and fills the play area. `@base/input` rebuilt + three-dbox typecheck clean. The static-container path is unchanged, so three-dreams / threejs-engine-dev are behavior-unchanged.

---

## Decisions

| Decision | Resolution |
|---|---|
| **draw-call strategy** (gate: end of EX-1) | **Defer `BatchedMesh`.** Idle draw calls are 120–180; worst-case 463. Draw calls are *not* the bottleneck — the **960K-tri character mesh** is. Batching is name-safe and stays available, but it is secondary to the asset fix. Revisit only if, after the character is decimated, the 463-draw courtyard view still costs frames on target hardware. |
| pixel-ratio cap | **Shipped** (`min(dpr,2)`, `?pixelratio` override). Free on the dev display; the real win is fill-bound hi-DPI hardware. |
| tone mapping / shadows | Left at defaults; tuning deferred to EX-3. |
| **NEW: character mesh optimisation** | **DONE 2026-06-13 (EX-1.5):** decimated `dfist_base.glb` **960,108 → 38,404 tris** (`weld` + `simplify --ratio 0.04 --error 0.01` + `draco`; 3.05 MB → 639 KB). Skin weights + `JOINTS_0`/`WEIGHTS_0` preserved; 40-bone skeleton mixer-verified live (clean idle deformation, sane local bbox 0.46×1.0×1.0, no console errors). Kept Draco — meshopt position-quantization breaks GPU skinning (per `src/scenes/dbox.ts`). No normals added (faithful to the flat-shaded source; EX-3 owns shading). Highest-ROI perf win in the track — delivered. The untracked alt-skins `dfist.glb` / `dfist_armored.glb` (33 MB each) are even heavier and still must be optimised before they're ever activated. |

## What shipped this session

- `src/debug/diagnostics.ts` — flag helpers (`hasQueryFlag`/`queryNumber`), `CountingSampler`, `PerfOverlay`. Self-contained; deletable after the EX track.
- `DboxSceneModule` — pixel-ratio cap + renderer audit log (unconditional); `?perf` overlay + 1 Hz monitor + `window.__dboxPerf` handle; `?navdebug` per-tick nav logger; named probe callback captured for navdebug; full cleanup in `onUnmount`.
- `DboxCharacterEntity` — `lastStepLiftY` / `lastWallPushDepth` diagnostic fields.
- Build clean (`vue-tsc` + vite). No production behaviour change (cap aside) without a flag.

## Next

**EX-2 — navigation reliability** (swept-cast anti-tunnelling + probe-Y/step fix), **plus** the new **character-mesh decimation** task (sequence it first — it's cheap and unblocks honest frame-time numbers for everything after).
