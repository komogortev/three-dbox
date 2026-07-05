# three-dbox — EX Track Implementation Plan (2026-06-12)

> Experience-floor track confirmed by owner playtest verdict ("good base, far from the experience"): lag, navigation glitches (fall-through, stairs, transitions), no audio, calibration-grade lighting.
> Runs **before** C2 → B1 → T-B18. Companion: `GAP-V1-PUBLISH-2026-06-12.md` §2b (triage), `ASSESSMENT-2026-06-10.md` (C-tier triggers C1/C3 fired here).
> Every surface below is direct-read-verified (2026-06-12). API names are real, not assumed.

## Package-boundary note

EX-1 and EX-3 stay **entirely in `three-dbox`** — `ctx.renderer` and `ctx.scene` are exposed on `ThreeContext` (`threejs-engine/src/types.ts:18`), so renderer/lighting tuning needs no SHARED edit. EX-2 **does** touch `@base/physics` (new swept query) — a SHARED change, rebuilt in dependency order (`physics → dbox`), benefiting all consumers. EX-4 consumes `@base/audio` unchanged (no SHARED edit). This keeps the riskiest cross-package work isolated to one session.

---

## EX-1 — Diagnosis + quick wins *(1 session)*

**Goal:** turn "it lags / it glitches" into numbers, and bank the cheap perf wins the measurement exposes.

### EX-1.1 Perf instrumentation (measure first)
- Build prod (`pnpm build` + `preview`) — dev-server HMR/sourcemaps inflate the felt cost; measure the shipped artifact.
- Live via preview tools: log `ctx.renderer.info` (draw calls, triangles, programs) once per second behind a `?perf=1` flag in `DboxSceneModule`; capture idle vs slam-hold (the F6 worst case) vs rocket-punch-traverse.
- Record: draw calls (hypothesis ~374 unbatched map meshes), frame time, `MeshTerrainSampler.sample` call count/frame.

### EX-1.2 Renderer quick wins (verified headroom, dbox-local)
In `DboxSceneModule.onMount` after super, mutate `ctx.renderer`:
- **Cap pixel ratio**: `setPixelRatio(Math.min(window.devicePixelRatio, 2))` — uncapped today (`ThreeModule.ts:42`); on hi-DPI this is the largest single lever (4–9× fragment work).
- Audit `shadowMap` (type/enabled/map size) and `toneMapping` + `toneMappingExposure` — currently engine defaults (no config). Tone mapping also sets up EX-3.
- Provide a `?perf` overlay toggle so the owner can A/B on their actual display.

### EX-1.3 Glitch instrumentation (feed EX-2)
- Behind `?navdebug=1`: each frame log player Y, `sampleTerrainSurfaceY` result, probe-Y origin, and active step-climb lift. Reproduce the stair/doorway pop and the fall-through; capture the numbers.
- Confirm or refute the probe-Y hypothesis: module passes `() => max(character.y + 1.0, 1.0)` (`DboxSceneModule.ts:168`) vs sampler contract "probe BELOW any ceiling, typical `character.y − 0.5`" (`MeshTerrainSampler.ts:38-43`).

### EX-1.4 Lighting baseline capture
- Screenshot Château under current (inherited sandbox) lighting at 2–3 vantage points; note the over-bright readings. Pure data-gathering for EX-3 — no changes.

**Deliverable:** a short `docs/EX-1-FINDINGS.md` (numbers + before/after screenshots) that sizes EX-2 and the draw-call decision. **Quick wins (EX-1.2) ship same session** if they don't regress visuals.
**Decision surfaced:** draw-call strategy — runtime `BatchedMesh` (mesh names survive; safe) vs GLB re-export join (breaks physics-filter/display-override name matching + EMPTY entity nodes — **not** safe without rework). Recommend BatchedMesh; decide with EX-1 numbers in hand.

---

## EX-2 — Navigation reliability *(1–2 sessions)*

**Goal:** kill fall-through-walls and stair/transition pops. The two highest-impact correctness fixes in the whole track.

### EX-2.1 Anti-tunneling swept resolve (fall-through)
Root cause (code + its own docstring): `spherePenetration` is overlap-only; "clip fully through a thin surface in one tick (possible at >2×radius/tick)" is documented (`PhysicsWorld.ts:70-72`). Rocket punch = 152 m/s ≈ 2.5 m/frame vs radius 0.4 → tunnels.

- **SHARED — `@base/physics`**: add `shapeCastSphere(from: Vector3, to: Vector3, radius: number): { toi: number; normal: Vector3 } | null` wrapping Rapier `world.castShape(pos, rot, vel, Ball(r), maxToi, …)`. Mirrors `castRayDown` style; pure additive (no existing API touched). Unit test with a thin wall + a from→to that steps over it.
- **dbox — `DboxCharacterEntity`**: when planar carry speed × dt exceeds a fraction of `playerRadius`, sweep last→current position; on a hit, place the character at the TOI contact and run the existing slide math. Below threshold, keep the cheap `spherePenetration` path (no perf regression on walking).
- Rebuild `physics` then `dbox`. Verify live: full-charge punch into every thin Château wall → stops, never passes.

### EX-2.2 Grounding + stairs (probe-Y + step smoothing)
- Apply the EX-1.3 finding. If probe-Y is the culprit: change the callback toward the documented `character.y − 0.5` form, **but** re-verify the spawn self-correction case the `+1.0` was added for (drop to ground from spawn height) — likely needs a one-shot spawn probe separate from the steady-state probe.
- Optional truth source: wire the dormant `castRayDown` (F13 — built, unused) as ground reference near thresholds where top-down sampling hits a lintel.
- Smooth step-climb: the walking-resolve full-depth lift (`DboxCharacterEntity.ts:192-194`) pops on stair nosings; clamp per-frame lift to a max rise and/or lerp. Verify on the Château mainhall stairs + every room transition.

### EX-2.3 (conditional) C1 capsule probe
Only if EX-2.1 leaves the F5 ±5 cm waist gap felt in play: add `capsulePenetration()` to `@base/physics` (`RAPIER.Capsule`), swap the dual-sphere. Deferred-by-default — swept resolve may make it moot.

**Named risk:** EX-2.2 is the one genuine *bug hunt* — if EX-1 instrumentation doesn't cleanly pinpoint it, this can spill past one session. EX-2.1 is well-understood and bounded.

---

## EX-3 — Atmosphere: per-map lighting *(1 session)*

**Goal:** Château reads as an OW1 dusk courtyard, not a calibration grid.

Root cause: no per-map lighting exists. Lighting is applied via `EnvironmentRuntime.attachGame(ctx, descriptor.atmosphere ?? {})` (`GameplaySceneModule.ts:453`) and `dboxScene = structuredClone(sandboxScene)` → Château inherits sandbox atmosphere. `MapDescriptorData` has **no** lighting field (schema read end-to-end).

### EX-3.1 Lighting schema
- `MapDescriptorData.lighting?` + runtime `MapDescriptor.lighting?`: `{ hemisphere?, ambient?, directional?: { color, intensity, position, castShadow? }, fog?: { color, near, far } | { exp2: color, density }, toneMappingExposure?, environmentIntensity? }`. Compile = pass-through (no regex).
- Apply in `DboxSceneModule.onMount` after super (super already built/attached environment; we add map lights + override `ctx.scene.fog`/`background` + `ctx.renderer.toneMappingExposure`). Track added lights for `onUnmount` disposal (F8 hygiene — do it right in new code).

### EX-3.2 Château dusk preset (live, iterative)
- Author a warm low-key directional (courtyard sun angle) + cool hemisphere fill + distance fog, tuned live against OW1 reference screenshots. **This is iterative feel-tuning with the owner** — I produce a strong first pass; final mood is a short back-and-forth.
- Honest expectation: evocative approximation. The rip carries no baked GI/lightmaps; we relight from scratch.

**Optional same-session:** if `ctx.renderer.shadowMap` is cheap enough per EX-1 numbers, one shadow-casting directional for ground contact. Cut if it costs frames.

---

## EX-4 — Audio foundation *(1 session)*

**Goal:** ambient bed + ability/impact SFX. Pulls T-B12 forward.

Surface verified: `AudioModule` + `AudioManager` (master/music/sfx/voice gain hierarchy, `sfxDestination`/`musicDestination`, volume setters) + `MusicLayer` (A/B crossfade, takes a decoded `AudioBuffer`). No SHARED edit needed.

### EX-4.1 Wiring
- Mount `AudioModule` (or `AudioManager.init()` sharing the listener context) in the dbox shell; gate the first `resume()` behind a user gesture (menu Play click — autoplay policy).
- Decode SFX buffers via `AudioContext.decodeAudioData` through a tiny loader; play one-shots as `BufferSource → sfxDestination`.

### EX-4.2 Triggers (events already exist)
- Ability SFX off `DoomfistLab` activation points (uppercut/slam fire, rocket-punch charge+release). Impact SFX on the slam/uppercut cone-hit and (post-EX-2) wall-stop. Footstep optional.
- Ambient bed via `MusicLayer` on map mount; `MapDescriptorData.ambientAudioUrl?` field (mirrors engine-dev interactional-room pattern).

### EX-4.3 Settings
- Master/music/sfx sliders in `SettingsView` → `AudioManager.set*Volume`. Persist via existing settings store.

**Asset constraint (named):** ship **CC0** SFX (Kenney / freesound-CC0) or synthesized placeholders — **not** ripped OW audio in a published build. Curation/synth is the session's main variable cost. I can synthesize functional placeholders immediately (WebAudio); curated CC0 is a short owner-or-me sourcing pass.

---

## Sequencing

```
EX-1 (1)  →  EX-2 (1–2)  →  EX-3 (1)  →  EX-4 (1)   →   C2 → B1+B2+SP-2 → B3+B4 → T-B18
```
- EX-1 first (measurement gates EX-2 scope + the draw-call decision).
- EX-2 before EX-3/EX-4 (correctness before polish; also the only SHARED-package + bug-hunt risk — front-load it).
- EX-3/EX-4 order-independent; both are mostly additive.
- P1 git pre-step (merge PR #5 → #6 → main, branch `feat/ex1-perf-diagnosis`) still applies before the first EX commit.

## What each session produces (capability calibration)

| Session | I deliver end-to-end (implement + build + live-verify + CodeReview + commit/PR) | Needs the owner |
|---|---|---|
| EX-1 | perf+glitch instrumentation, `EX-1-FINDINGS.md` with numbers/screens, renderer quick-wins shipped | confirm quick-wins feel right on their display; draw-call decision |
| EX-2 | swept-cast in `@base/physics` (+unit test), entity swept resolve, probe-Y/step fix, both rebuilt + live-proven | playtest the fall-through + stairs to confirm "fixed" |
| EX-3 | lighting schema + compile + apply + disposal, Château first-pass dusk preset | mood sign-off (iterative — a few screenshot rounds) |
| EX-4 | audio wiring, trigger points, settings sliders, placeholder SFX working | swap/approve final CC0 asset set + mix levels |
