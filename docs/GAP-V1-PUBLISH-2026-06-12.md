# three-dbox — Gap to First Published Iteration (2026-06-12)

> Goal statement (direction call, 2026-06-12): give a visitor an **OW1 experience in limited form** — single player, one/two play modes, first published iteration.
> Method: direct read of source + roadmap + deploy infra during the 2026-06-12 readiness session. Companion: `PLAN-C2-CHAMPIONS-2026-06-12.md` (sequencing) and `ASSESSMENT-2026-06-10.md` (B-tier specs).

## 1. V1 definition (proposed — cheapest honest version of the goal)

- **Mode 1 — Score Attack**: Château Guillard, 60 s round, score = damage / KOs / packs / deaths, results screen, Play Again. This is exactly the T-B18 track; no new systems beyond it.
- **Mode 2 — Practice Range**: sandbox calibration arena, free play, no timer. Exists today; "mode" is a menu framing, not new code.
- Single champion (Doomfist). Champion select UI optional after C2 (registry makes it a menu row).
- Desktop browser, pointer-lock. PWA install + GitHub Pages — **already wired**.
- **Experience floor is in-scope for V1** (added 2026-06-12 after owner playtest): smooth frame rate, reliable walls/stairs/transitions, map-appropriate lighting, baseline audio — see §2b. A laggy, glitchy, bright-lit build is not "the OW1 experience in limited form" regardless of feature count.

## 2. System gap table

| System | Status | Remaining for V1 | Effort |
|---|---|---|---|
| Movement + 3 abilities (punch/slam/uppercut) | ✅ | tuning only | — |
| Round structure (T-B17) | ✅ | — | — |
| OW map + Rapier physics + health packs | ✅ | ongoing polish/calibration passes | S (ongoing) |
| Deploy + PWA (`deploy-github-pages.yml`, vite-plugin-pwa manifest) | ✅ | verify live URL after PR merges | S |
| Champion/target architecture (C2) | planned | 1 session — `PLAN-C2-CHAMPIONS-2026-06-12.md` | M |
| Health/damage (B1) + respawn (SP-2) + stats (B2) | specced | 1 session; OD-1..OD-3 must be resolved first | M |
| Results screen + round gating (B3+B4 = T-B18) | specced | 1 session | S–M |
| Targets on the OW map (today: sandbox-only blobs) | ❌ | post-C2: spawn set in `MapDescriptorData` → TargetSystem; Score Attack needs things to hit | S–M |
| Hand Cannon (T-B8 — HUD slot already renders it, cd 0) | ❌ | hitscan vs `TargetSystem.getTargets()` post-C2 | M |
| Passive shields (T-B9 — `HudSnapshot.shields` field exists) | ❌ | rides HealthManager; optional for V1 | S |
| Pause menu (Phase 4 remainder) | ❌ | overlay + resume/restart/menu | S |
| Crosshair | ❌ | static center reticle | S |
| Hit feedback (T-B10 hit-stop + shake) | ❌ | manual camera shake + brief time-dilation (dilation hooks exist) | S–M |
| Audio (T-B12) | ❌ | `@base/audio` MusicLayer exists; needs CC0 SFX set + trigger wiring | M |
| VFX juice (punch trail, slam ring, sparks) | ❌ | nice-to-have; cuttable from V1 | M |
| Navigation reliability (tunneling, stairs, transitions) | ❌ | EX-1 diagnosis → EX-2 fixes (§2b) | M–L |
| Per-map lighting / atmosphere | ❌ | EX-3 descriptor lighting schema + Château pass (§2b) | M |
| Perf (C3 BVH + draw calls) | **fired** | EX-1 measurement → BVH + batching strategy (§2b) | M |

**The V1 cut line:** Score Attack is *playable and honest* after C2 → B1/B2/SP-2 → B3/B4 + map targets + crosshair + pause. Hand cannon, shields, VFX, and audio are the difference between "playable" and "feels like OW1" — audio and hit feedback are the highest juice-per-hour of those.

## 2b. Experience floor — playtest feedback fold-in (2026-06-12, same day)

Owner playtest verdict: lag / unsmooth navigation, occasional fall-through-walls, stairs and room-transition glitches, no audio, calibration-grade lighting. Verdict accepted: **the experience floor is part of V1, not polish** — the §2 table under-weighted it. Triage (code-verified):

| Complaint | Root-cause hypothesis (evidence) | Fix path |
|---|---|---|
| Lag / unsmooth | `MeshTerrainSampler.sample()` is a linear `intersectObjects` over all ~374 map meshes, no BVH (`MeshTerrainSampler.ts:74`; its own docstring names `three-mesh-bvh` as the escape). Slam-hold worst case: ~700 ray-march steps × full 374-mesh scan *per frame* (F6 mechanism, now user-felt). ~374 separate meshes ≈ ~374 draw calls — no batching/joining was applied to the map GLB. Renderer settings (pixelRatio, shadows, tone mapping) never audited; dev-server vs prod-build delta unmeasured. | **EX-1** measure first (renderer.info, frame trace, prod build), land quick wins same session; **C3 BVH now fired**; draw-call strategy is a decision item — mesh names are load-bearing (physics filters, display overrides) and EMPTY entity nodes must survive, so runtime `BatchedMesh` over a re-export join is the likely safe route |
| Falling through walls | Rocket punch carry reaches 152 m/s (`doomfist.ts:23`) ≈ 2.5 m/frame @60 fps; `spherePenetration` is an overlap-only post-tick probe — a wall thinner than the frame step is never seen (classic tunneling). Plus F5's ~±5 cm waist band for thin horizontal edges. | **EX-2**: swept/substepped resolve above a carry-speed threshold (Rapier `castShape` along displacement, or fixed-distance substepping) + C1 capsule probe (`@base/physics` addition — SHARED change) |
| Stairs / room transitions | Probe-Y contradiction: module passes `() => max(character.y + 1.0, 1.0)` (`DboxSceneModule.ts:168`) while the sampler's own contract says probe must be *below any ceiling the character could stand under*, typical `character.y − 0.5` (`MeshTerrainSampler.ts:38-43`). Door lintels / stair undersides / upper slabs read as "floor" near thresholds → snaps and pops. Step-climb lift from noisy penetration normals on stair nosings (`normal.y > 0.3`) adds jitter. | **EX-1** instrument (log probe Y + sampled ground at glitch moments); probe fix candidate must re-verify the spawn self-correction path that motivated `+1.0`; **EX-2** grounding unification — dormant `PhysicsWorld.castRayDown` (F13) as collision-truth ground, step smoothing |
| Lighting wrong / too bright | No per-map lighting exists anywhere: `MapDescriptorData` has no lighting section (schema read end-to-end), and Château inherits the *calibration sandbox* descriptor's lighting (`dboxScene = structuredClone(sandboxScene)`). The OW rip carries no baked GI. | **EX-3**: `MapDescriptorData.lighting` schema (hemisphere/ambient, directional, fog, tone-mapping exposure, optional envmap) + apply in `onMount` + Château dusk preset tuned live against OW1 reference shots. Expectation: evocative approximation, not parity — baked GI is not recoverable from the rip |
| No sound / music | T-B12 never started (was parked in Phase 5). | **EX-4**: pull forward — `@base/audio` MusicLayer ambient bed + ability/impact SFX (CC0/synth), volume in settings, per-map ambient track field in the descriptor (mirrors the engine-dev interactional-room pattern) |

### EX track (inserted ahead of the mechanics train — recommended)

```
EX-1 diagnosis + quick wins (perf numbers, glitch instrumentation, lighting baseline)   1 session
EX-2 navigation reliability (tunneling sweep, capsule probe, grounding/stairs)          1–2 sessions
EX-3 atmosphere: per-map lighting schema + Château mood pass                            1 session
EX-4 audio foundation (T-B12 forward)                                                   1 session
→ then C2 → B1+B2+SP-2 → B3+B4 → T-B18 (unchanged internally)
```

Named trade: T-B18 slips ~4 sessions. Counter-argument that wins: B1+ damage tuning playtested on a janky base produces numbers that don't transfer; every subsequent session benefits from a stable floor. EX-2 work largely lands in `SHARED/packages` (`@base/physics`, possibly `@base/player-three`) — benefits all consumers per package-boundary rule.

## 3. Leverage assessment

### Already banked (zero remaining cost)
- Full `@base/*` engine stack (camera presets, input remapping UI, player controller, audio layer, PWA core).
- Rapier trimesh physics via `@base/physics`; draco+webp GLB pipeline; OWLib→Blender→gltf-transform map pipeline documented and repeatable; `entityScan` survey tooling for any future map.
- CI deploy to GitHub Pages with SPA fallback + PWA manifest — Phase 5's "PWA packaging + deploy target" items are effectively done.

### Claude-side acceleration (how sessions stay short)
- **Live preview verification loop** — every change proven in-browser same session (workspace standard; all of Tier A was live-verified).
- **Subagent gates** — CodeReview before commits, Refactor/Debug flows, with the established anti-hallucination guardrails.
- **code-review-graph MCP** — impact-radius analysis available for the C2 lab surgery.
- **Fast to author on demand**: Vue overlays (pause/results), HUD/SVG art (crosshair, portraits), WebAudio synth placeholder SFX, Blender headless scripts, procedural geometry, CI tweaks, stats plumbing.
- **Reference data**: OW1 numbers (250 HP, pack 75/250 HP, ability damage/cooldowns) retrievable from public wikis to seed OD-1/OD-3 tuning.
- **Hard limits** (don't plan around them): production-quality character meshes/animations cannot be generated — image-to-3d track is NO-GO for characters; champion #2's mesh comes from Trinity/OWLib-style exports + Mixamo retarget like Doomfist did. OW-quality audio likewise — use CC0.

### Third-party shortlist (license-clean, each closes a named gap)
| Library / asset source | Closes | Note |
|---|---|---|
| `three-mesh-bvh` (MIT) | C3 terrain/slam-ray perf | adopt on trigger, not preemptively |
| Kenney audio packs (CC0) / freesound (per-file CC) | T-B12 SFX | do **not** ship ripped OW audio in a published build |
| `yuka` (MIT) | moving NPC enemies | post-V1 only; V1 targets are physics blobs |
| pmndrs `postprocessing` (zlib) | VFX polish | optional; manual camera shake suffices for T-B10 |
| — no netcode, no state lib, no UI kit | — | single-player V1 is the scope shield; Pinia/Tailwind already in |

## 4. Publishing gate (named risk — decision deferred to owner)

Château Guillard GLB and the Doomfist kit/likeness are Blizzard IP. An **unlisted, non-commercial fan-demo** posture is community-normal but takedown-exposed; a broader public release should consider the asset-swap variant (procedural arena via the existing roomMeshGen-style tooling + an original champion — C2's registry makes the swap cheap). Flagged per the pivot-point rule; no action required before V1 scoping, but the call gates how loudly V1 is "published."

## 5. Session estimate to V1 publish *(revised 2026-06-12 after playtest fold-in)*

```
EX-1 (1)  →  EX-2 (1–2)  →  EX-3 (1)  →  EX-4 (1)
→  C2 (1)  →  B1+B2+SP-2 (1)  →  B3+B4 + pause + crosshair (1)
→  map targets + hand cannon (1–2)  →  hit feedback [+ VFX] (1)
→  QA / tuning / publish pass (1)
```

- **Full V1 as defined above: ~9–12 sessions** at current cadence (was 6–8 before the experience floor was priced in — the playtest verdict "good base, far from the experience" is what those +3–4 sessions are).
- **Minimum honest V1** (cut hand cannon, shields, VFX; keep EX-1/EX-2/EX-3, audio-lite, crosshair): **~8–9 sessions**. The EX track is not cuttable — it *is* the complaint list.
- Largest variance sources: EX-2 (collision work in SHARED packages, live repro time), draw-call strategy outcome from EX-1, map-target spawn calibration, audio curation.
