# three-dbox — Systems Assessment & Fix Plan (2026-06-10)

> Full-source soundness review conducted at Phase 3 close / Phase 4 start (T-B17 shipped, T-B18 queued).
> Method: direct read of all core systems — `DboxSceneModule`, `DboxCharacterEntity`, `MapDescriptor` + `chateauGuillard`, `RoundManager`, `HealthPackExtractor/Manager`, `MeshTerrainSampler`, `DoomfistLab`, `IAbilityLab`, `arenas/registry`, `DboxView`, `SandboxSceneModule`, forked `GameplaySceneModule`, `@base/physics` (`PhysicsWorld`, `extractTrimesh`), `doomfist.ts` config, plus git history/remote state.
> Not verified in this pass: `pnpm build` and live play (STATE.md claims clean as of `f4454a3`).

## 1. Verdict

Architecture is **sound**. The orchestrator → lab → entity → descriptor layering is clean (orchestrator is 272 lines and genuinely delegates), the data-first `MapDescriptorData → compileMapDescriptor()` pattern is the best-authored descriptor pipeline in the workspace, and the `@base/physics` hybrid landed exactly as the locked architecture specified (query-only Rapier, carry system untouched, package boundary holds).

Three concrete defects, one milestone-sequencing risk (T-B18 has no stats to show without a health/damage system), and accumulated doc/process drift. No structural rework needed.

## 2. Findings register

| ID | Class | Sev | Finding | Evidence |
|----|-------|-----|---------|----------|
| F1 | Defect | Med | Health-pack rotation cycling is inert — always rotation 0 | `spawnCount` is an instance field (`DboxSceneModule.ts:52`); `DboxView.vue:50` builds a fresh module every navigation, and T-B17 restart is a menu-detour remount. Counter never exceeds 0 at `mount()` time. |
| F2 | Defect | Med | Ability cooldowns use wall-clock; round timer + pack respawns use sim time | `DoomfistLab` gates CDs via `performance.now()` (`DboxLab.ts:222,557,587,629`); `RoundManager.tick(simDelta)` + `HealthPackManager.tick(dt)` use sim seconds. Pause 6 s → all CDs refresh while round froze. Slow-mo skews CD-per-sim-second. Also `lastPunchMs` etc. store **seconds**, not ms. |
| F3 | Defect | Low | Map-load-failure fallback renders a void | `useSandboxScene()` returns `!this.map` (`DboxSceneModule.ts:68`) — decided from descriptor *presence* before the load attempt. On GLB failure the catch (`:103`) claims "using hand-authored arena": analytic walls + blobs activate but sandbox terrain/sampler/geometry were skipped. |
| F4 | Gap | Med | Round state is presentational only | Nothing gates input on `countdown`/`ended`. Pointer-lock release stops mouse-look; WASD + abilities stay live under the end screen. Stats would keep accumulating post-round once they exist. |
| F5 | Gap | Low-Med | Dual-sphere probe has a waist coverage window | Half-height 0.85, r 0.4 → spheres at ±0.45 give zero lateral coverage in a ~±5 cm band at capsule centre. Vertical walls caught by both spheres; a thin **horizontal** edge at waist height can slip through. |
| F6 | Risk | Low | Slam preview terrain-march worst case ~700 samples/frame | `SLAM_RAY_T_MAX 280 / 0.4` step (`DboxLab.ts:277`) against 374 non-BVH meshes during slam hold. Early-out keeps typical cost small; grazing angles are the worst case. `three-mesh-bvh` already named as escape hatch in `MeshTerrainSampler` docs. |
| F7 | Debt | Med | Champion lab owns arena targets | Blob NPC spawn/physics/wall-bounce live in `DoomfistLab`; `setWallGeometry` exists on `IAbilityLab` only for blobs. Blocks clean champion #2 and map-mode NPC enemies. |
| F8 | Debt | Med | Forked `GameplaySceneModule` predates engine-dev's 2026-06-02 remount/disposal fixes | No `onMount()` flag resets; `scene.clear()` without GPU disposal; sandbox/arena/debug-marker meshes removed but never `dispose()`d. Mitigated today by fresh-module-per-view + engine teardown, but the 800-line copy silently diverges from the fixed engine-dev original. |
| F9 | Process | High-value | `main` frozen at initial April commit | All 14 feature commits live on `docs/phase2-sync-2026-04-13` (pushed ✓, misnamed, never merged; no PR flow unlike SHARED/engine-dev/planner). |
| F10 | Process | High | `public/maps/chateau-guillard.glb` untracked | Load-bearing 8.8 MB asset exists only on this machine. Pipeline reproducible (Open3DLab → Blender → gltf-transform draco) but costs hours. |
| F11 | Docs | Med | PROJECT.md / CLAUDE.md stale | PROJECT.md "Current state" frozen 2026-04-13; both said "not Rapier" pre-hybrid. *(Fixed in the 2026-06-10 doc pass.)* |
| F12 | Docs | Low | Stale code comments contradict the sanitizeNodeName finding | `chateauGuillard.ts:49` still says hashes are "safe to match via `\.HASH\.`"; `MapDescriptor.ts:198` documents entity node names as `"Entity <HexId>.<instance>"` while the extractor's observed convention is 15-char `00000000<TypeHex4><Instance3>`. `DboxView` keymap panel hardcodes CD text ("4 s CD") that lives in champion config. |
| F13 | Note | — | `PhysicsWorld.castRayDown` unused by dbox | Tier-1 plan said Fix 2 would use it; shipped step-climb uses penetration normal (`normal.y > 0.3` lift). Keep the API (useful for elevated-spawn probes) — just know it's dormant. |

Positive findings worth keeping as conventions: honest inline limitation docs (`PhysicsWorld.spherePenetration` inverted-normal note), deliberate documented asymmetry in step-climb lift (carry: `depth × normal.y`; walking: full `depth` — see `DboxCharacterEntity` comments), `RoundManager`/`HealthPackManager` as pure-data tick managers polled by the view, and the registry's 2-file map onboarding.

## 3. Fix plan

Naming: A/B/C tiers to avoid colliding with the shipped Tier-1 "Fix 0–3" series.

### Tier A — correctness fixes (~half session, no design decisions)

**A1 — Unify ability cooldowns on sim time (F2).**
`DoomfistLab` accumulates `private simTimeS = 0` in `afterGameplayTick(simDelta)`; all cooldown reads/writes (`tryUppercut`, `executeSlamOnKeyRelease`, `fireRocketPunchFromHoldSeconds`, `getHudAbilities`) switch from `performance.now() * 0.001` to `this.simTimeS`. Rename `lastPunchMs/lastUppercutMs/lastSlamMs → lastPunchSimS/...`. Initial `-1e9` values unchanged. Out of scope (note only): `RocketPunchPointer` hold duration is wall-clock by nature (pointer events) — charging during pause remains possible; revisit only if it bothers playtests.
*Verify live: pause with P → CDs must freeze; ×0.5 slow-mo → CD sweep slows.*

**A2 — Make health-pack rotation actually cycle (F1).**
Replace the instance field with a module-scope counter in `DboxSceneModule.ts` (`let arenaSpawnCounter = 0` at file scope) — survives component remounts within the SPA session, which is the original intent ("each visit cycles"). Read-then-increment in `onMount()`.
*Verify live: Play Again twice → console shows rotation 0 → 1 → 2.*

**A3 — Make the map-load fallback truthful (F3).**
Move the GLB load to the *top* of `DboxSceneModule.onMount()`, before `super.onMount()` (the `ThreeContext` param already carries `assets`; only `scene.add` must wait until after super). On failure: `console.error` + `this.map = undefined` (field becomes non-readonly) → `useSandboxScene()` then genuinely returns true → sandbox terrain/sampler/geometry build → walls/blobs land in a real arena.
*Verify live: temporarily break the glbUrl → expect playable sandbox, not a void.*

**A4 — Comment/doc nits while in the files (F12).**
Fix the `\.HASH\.` comment in `chateauGuillard.ts`, the entity-name convention comment in `MapDescriptor.ts`, and source the keymap CD text in `DboxView` from `DOOMFIST_CONFIG`.

### Tier B — health/damage + T-B18 (pulled forward; 2 sessions)

Rationale: T-B17's only end condition is the timer, and the only stat available is "time survived" — which a timer-ended round makes constant. A results screen without damage/pickup/KO data is an empty frame. The receptacles already exist: `HealthPackManager.tick()` returns `hpGain` (currently console-logged), `HudSnapshot.health` is hardcoded 250, blobs have no HP field.

**B1 — `HealthManager` + blob HP + damage stats (session 1).**
- `src/health/HealthManager.ts` mirroring `RoundManager` style: `{ hp, maxHp, heal(n): number, damage(n), getSnapshot() }` — pure data, no Three.js.
- `DboxSceneModule` owns `playerHealth`; `getHudSnapshot()` reads real values; `hpGain` flows into `playerHealth.heal()`.
- `HealthPackManager`: skip pickup at full HP (OW behaviour) — pass current-HP accessor or a `canHeal` predicate into `tick()`.
- `BlobNpc.hp` + per-ability damage values added to `ChampionConfig` (`risingUppercut.damage`, `seismicSlam.damage`; rocket punch impact damage deferred until wall-impact detection matters).
- Stats channel: extend `GameplayLabHost` with `recordDamage(amount)` / `recordKo()` (interface change — update `DboxSceneModule` + `DoomfistLab` together per CLAUDE.md rule).

**B2 — Round stats accumulation (with B1).**
`RoundStats { damageDealt, kos, packsCollected }` owned by `DboxSceneModule`, reset in `onMount`, frozen when round ends, exposed via `getRoundStats()`.

**B3 — T-B18 results screen (session 2).**
Extend the existing ended-overlay in `DboxView` with a stats grid: time survived (`snapshot.elapsed`), damage dealt, KOs, packs collected. No new routes or components needed beyond the overlay.

**B4 — Round gating (with B3).**
Abilities fire only in `playing` (lab checks `host.isRoundPlaying()` — same host-interface change batch as B1); stats stop accumulating on `ended`. Movement stays live during countdown (standard spawn-room behaviour) — only ability activation is gated.

### Tier C — structural debt (triggered, not scheduled)

| ID | Work | Trigger |
|----|------|---------|
| C1 | Capsule probe: add `capsulePenetration()` to `@base/physics` (`RAPIER.Capsule` in `intersectionWithShape`), replace dual-sphere in `DboxCharacterEntity` (F5) | Waist-gap penetration reproduced in play, or Phase 5 ship-quality pass |
| C2 | Extract target/NPC system from `DoomfistLab`; remove `setWallGeometry` from `IAbilityLab` (F7) | Champion #2, or map-mode NPC enemies (MapDescriptor spawn flow) |
| C3 | `three-mesh-bvh` for `MeshTerrainSampler` (F6) | Measured frame cost during slam hold on larger maps |
| C4 | Fork-sync pass: port engine-dev's onMount resets + GPU disposal patterns into the local `GameplaySceneModule`/`SandboxSceneModule` copies (F8) | Next remount-class bug, or Phase 5 perf pass |

### Process fixes (P, ~10 min, this week)

- **P1 (F9):** Commit the map GLB (8.8 MB is fine to track), then merge `docs/phase2-sync-2026-04-13` → `main` (PR for the review trail, consistent with other repos). Use feature branches (`feat/...`) from then on.
- **P2 (F10):** covered by P1's first step — `git add public/maps/`. `dfist.glb` / `dfist_armored.glb` stay untracked deliberately (alt skins, documented in STATE.md inventory).

## 4. Open decisions (flag before B1 implementation)

| ID | Question | Proposed default |
|----|----------|------------------|
| OD-1 | Player damage source V1: wire the existing landing-tier system (sandbox legend already defines soft→fatal at 2/4/7/11/22 m) into fall damage? Without *some* damage source, packs and player HP are cosmetic. | Yes — map hard/critical/fatal to ~10/25/100 damage; numbers in `ChampionConfig` |
| OD-2 | Blob KO behaviour at 0 HP | Respawn in place at full HP after ~8 s; increments `kos` |
| OD-3 | Ability damage numbers | OW1-flavoured placeholders (uppercut 50, slam 50–125 by range), tuned in playtest |

## 5. Deferred-risk register (named per pivot-point rule)

- Deferring **C1** keeps the ~±5 cm waist window: thin horizontal ledges at capsule-centre height can be penetrated until then.
- Deferring **C4** keeps GPU geometry/material disposal gaps on every menu↔arena cycle; bounded by engine teardown but unmeasured.
- Deferring **OD-1** (if declined) ships B1 with player HP that can only go up — packs become score pickups, not survival resources.
- `wateredgewaves`/clouds share hash `81B09AB0F566B1D2` with castle walls — permanently indistinguishable by name; any future cloud-collision complaint requires GLB re-export with renamed collections, not a filter fix.

## 6. Sequencing

```
A1–A4 + SP-1 (Tier A session)  →  B1+B2+SP-2 (session)  →  B3+B4 (session)  →  T-B18 closed
P1/P2 any time this week (independent)
C1–C4 by trigger
```

> **Addendum 2026-06-10 (post-assessment spawn scoping):** SP-1 (decouple player spawn data from health-pack entities; includes A2 implementation as `packRotationCounter`) and SP-2 (instant respawn with spawn rotation at player HP 0 — the player-death behaviour this plan left unspecified) spliced in per `PLAN-SPAWN-2026-06-10.md`. Locked: V1 = instant respawn with rotation; death cam = Phase 5.

After T-B18: pause menu (Phase 4 remainder) → Phase 2 close leftovers (crosshair, hit-stop/shake T-B10, ability remapping UI, uppercut ceiling clamp) → Phase 2B / Phase 5 per ROADMAP.md.
