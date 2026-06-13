# three-dbox — Sprint: Experience Floor → V1 Publish

> **Sprint goal:** take the "good base, far from the experience" build to a publishable V1 — an OW1 experience in limited form (single player, Score Attack + Practice Range), with a smooth/reliable/atmospheric/audible floor.
> **Created:** 2026-06-12. **Plan of record** for the session series. Each session reads this file first to find its position.
> Source plans: `PLAN-EX-EXPERIENCE-FLOOR-2026-06-12.md` · `PLAN-C2-CHAMPIONS-2026-06-12.md` · `GAP-V1-PUBLISH-2026-06-12.md` · `PLAN-SPAWN-2026-06-10.md` · `ASSESSMENT-2026-06-10.md`.

## Current position

➡️ **EX-1 done (2026-06-13). Next: char-mesh decimation (EX-1.5, new) → EX-2.** Findings: `docs/EX-1-FINDINGS.md`.
Measurement revised the perf hypothesis: the lag driver is **not** unbatched draw calls — it is a **960K-triangle player mesh** (`dfist_base.glb`, un-decimated Tripo export = 73% of scene geometry) plus fill cost on hi-DPI displays. Draw calls are 120–180 typical / 463 worst-case; render is vertex-bound (flat across pixelRatio) on the dev GPU. Pixel-ratio cap shipped. **BatchedMesh deferred.**

## Pre-sprint gate *(resolved 2026-06-13)*

- [x] **P1 git:** PR #5 + PR #6 were **already merged** to `main` (commits `ffe080b`, `d27a961`) — `main` is unfrozen. The only open PR is **#7** (`docs/v1-ex-sprint-plan`, the plan-of-record docs); owner to merge when ready.
- [x] Branch `feat/ex1-perf-diagnosis` cut (off `docs/v1-ex-sprint-plan` so the sprint tracker + findings travel with the work; rebase onto `main` once #7 lands).
- Untracked alt-skin GLBs (`dfist.glb`, `dfist_armored.glb`) stay untracked by design (P2) — **also 33 MB / heavily un-decimated; optimise before ever activating.**

## Session series

Legend: ☐ not started · ◐ in progress · ☑ done. One session per row unless noted.

### Phase EX — experience floor *(this sprint's reason for existing)*

| # | Session | Entry | Exit criterion (live-verified) | Plan | Status |
|---|---|---|---|---|---|
| EX-1 | Perf + glitch diagnosis, renderer quick wins | pre-sprint gate done | `EX-1-FINDINGS.md` with draw-call/frame numbers; pixel-ratio cap shipped, no visual regression; stair/fall-through root-caused + instrumented; draw-call strategy decided (**defer BatchedMesh**) | EX §EX-1 | ☑ |
| EX-1.5 | **Character-mesh decimation** *(new — top EX-1 finding)* | EX-1 | `dfist_base.glb` 960K → ~30–50K tris via gltf-transform weld+simplify; rig + locomotion clips still play; live-verified | EX-1 findings §Decisions | ☐ |
| EX-2 | Navigation reliability | EX-1 numbers | full-charge punch into every thin wall stops (no tunneling); stairs + room transitions traverse without pops | EX §EX-2 | ☐ |
| EX-2b | *(contingency)* stair bug spillover / C1 capsule | only if EX-2 unresolved | — | EX §EX-2.2/2.3 | ☐ |
| EX-3 | Per-map lighting + Château dusk | EX-2 stable | lighting schema applied; Château reads as dusk courtyard (owner mood sign-off) | EX §EX-3 | ☐ |
| EX-4 | Audio foundation | — | ambient bed + ability/impact SFX + volume sliders working; placeholder/CC0 assets | EX §EX-4 | ☐ |

### Phase mechanics — V1 game systems *(unchanged internally; sequence locked)*

| # | Session | Entry | Exit criterion | Plan | Status |
|---|---|---|---|---|---|
| C2 | Target-system extraction + champion registry | EX track done | blobs → `TargetSystem` (no behavior change, live parity); `CHAMPION_REGISTRY`; per-arena counter keying | C2 plan | ☐ |
| B1+B2+SP-2 | Health/damage + stats + instant respawn | C2 done; **OD-1..OD-3 resolved** | real HUD HP; packs heal/skip-at-full; blob HP+KO; fall damage; respawn cycles; stats accumulate | Assessment §B + Spawn §SP-2 | ☐ |
| B3+B4 | Results screen + round gating + pause + crosshair | B1 done | menu→arena→play→results→menu loop; abilities gated to `playing`; pause overlay; reticle | Assessment §B3/B4 | ☐ |
| MAP-TGT | Targets on Château (Score Attack needs things to hit) | C2 done | map-mode target spawn set in `MapDescriptorData` → `TargetSystem` | GAP §2 | ☐ |

### Phase ship — V1 close *(juice + publish; some cuttable)*

| # | Session | Notes | Status |
|---|---|---|---|
| SHIP-1 | Hand Cannon (T-B8) + hit feedback (T-B10 shake/hit-stop) | hand cannon cuttable from min-V1 | ☐ |
| SHIP-2 | QA / tuning / publish pass | verify live GH-Pages URL + PWA install | ☐ |

## Open decisions (resolve at the named gate, not before)

| ID | Decision | Gate | Default |
|---|---|---|---|
| ~~draw-call~~ | ~~BatchedMesh vs GLB re-export join~~ → **RESOLVED 2026-06-13: defer BatchedMesh.** Draw calls (120–180 typ / 463 worst) are not the bottleneck; the 960K-tri character mesh is. Revisit only if courtyard worst-case still costs frames after EX-1.5. | ~~end of EX-1~~ | — |
| lighting | Château dusk mood | iterative in EX-3 | warm low-key sun + cool fill + fog |
| audio-assets | CC0 set vs synth placeholders | EX-4 | placeholders first, swap later |
| OD-1 | fall damage as V1 player damage source | before B1 | yes — 10/25/100 by landing tier |
| OD-2 | blob KO behaviour | before B1 | respawn in place ~8 s, `kos++` |
| OD-3 | ability damage numbers | before B1 | OW1 placeholders (uppercut 50, slam 50–125) |
| publish-posture | unlisted fan-demo vs asset-swap variant | before SHIP-2 | unlisted; revisit if going loud |

## Definition of done (sprint)

Visitor opens the deployed URL → installs PWA (optional) → picks Château **Score Attack** → moves smoothly with no fall-through/stair glitches → fights blobs with 3 abilities under map-appropriate dusk lighting with ability/impact audio → 60 s round → results screen with stats → Play Again. **Practice Range** available as mode 2. Single champion (Doomfist); champion select optional.

## Session-estimate envelope

Full V1 ≈ **9–12 sessions** (EX 4–5 · mechanics 3–4 · map-targets 1 · ship 1–2). Minimum honest V1 ≈ **8–9** (cut hand cannon/shields/VFX; EX track is not cuttable — it is the complaint list).

## Progress log

- **2026-06-13** — **EX-1 shipped** (`feat/ex1-perf-diagnosis`). Flag-gated diagnostics (`src/debug/diagnostics.ts`): `?perf` 1 Hz `renderer.info` overlay + `window.__dboxPerf` handle, `?navdebug` per-tick nav logger; `DboxCharacterEntity.lastStepLiftY`/`lastWallPushDepth`. Renderer quick win: **pixel-ratio cap `min(dpr,2)` shipped** (`?pixelratio=N` override) + tone/shadow audit logged. Live-measured via the handle (build-independent figures). **Findings revised the hypothesis** (`docs/EX-1-FINDINGS.md`): #1 lever is the **960K-tri `dfist_base.glb` player mesh (73% of geometry)**, not draw calls (120–180 typ / 463 worst); render is vertex-bound on the dev GPU (flat across pixelRatio → cap is hi-DPI insurance). Probe-Y stair bug + `spherePenetration` tunnelling both root-caused by code for EX-2. Lighting baseline captured (inherited sandbox noon atmosphere). Bonus: found a latent `TouchProvider` mount-side container-collapse (0×0 canvas) bug. **Decisions: defer BatchedMesh; new EX-1.5 char-mesh decimation task inserted before EX-2.**
- **2026-06-12** — Sprint created. Planning session: confirmed multi-champion near-term (C2-first), assessed gap-to-V1, folded owner playtest verdict into the EX experience-floor track ahead of all mechanics work, wrote EX implementation plan (all APIs direct-read-verified). No code. Next: pre-sprint git gate → EX-1.
