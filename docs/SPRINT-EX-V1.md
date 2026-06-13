# three-dbox — Sprint: Experience Floor → V1 Publish

> **Sprint goal:** take the "good base, far from the experience" build to a publishable V1 — an OW1 experience in limited form (single player, Score Attack + Practice Range), with a smooth/reliable/atmospheric/audible floor.
> **Created:** 2026-06-12. **Plan of record** for the session series. Each session reads this file first to find its position.
> Source plans: `PLAN-EX-EXPERIENCE-FLOOR-2026-06-12.md` · `PLAN-C2-CHAMPIONS-2026-06-12.md` · `GAP-V1-PUBLISH-2026-06-12.md` · `PLAN-SPAWN-2026-06-10.md` · `ASSESSMENT-2026-06-10.md`.

## Current position

➡️ **Pre-sprint gate (git hygiene) — then EX-1.** No EX code written yet. This session was planning only.

## Pre-sprint gate *(owner decision + ~10 min)*

- [ ] **P1 git:** merge PR #5 (`docs/phase2-sync-2026-04-13` → main) then PR #6 (`feat/tier-a-spawn-decouple` → main) to unfreeze `main`. *(Owner dismissed this question 2026-06-12; still open.)*
- [ ] Branch `feat/ex1-perf-diagnosis` off updated `main`.
- Untracked alt-skin GLBs (`dfist.glb`, `dfist_armored.glb`) stay untracked by design (P2).

## Session series

Legend: ☐ not started · ◐ in progress · ☑ done. One session per row unless noted.

### Phase EX — experience floor *(this sprint's reason for existing)*

| # | Session | Entry | Exit criterion (live-verified) | Plan | Status |
|---|---|---|---|---|---|
| EX-1 | Perf + glitch diagnosis, renderer quick wins | pre-sprint gate done | `EX-1-FINDINGS.md` with draw-call/frame numbers; pixel-ratio cap + tone-mapping shipped, no visual regression; stair/fall-through reproduced + instrumented; draw-call strategy decided | EX §EX-1 | ☐ |
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
| draw-call | BatchedMesh vs GLB re-export join | end of EX-1 (numbers in hand) | BatchedMesh (name-safe) |
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

- **2026-06-12** — Sprint created. Planning session: confirmed multi-champion near-term (C2-first), assessed gap-to-V1, folded owner playtest verdict into the EX experience-floor track ahead of all mechanics work, wrote EX implementation plan (all APIs direct-read-verified). No code. Next: pre-sprint git gate → EX-1.
