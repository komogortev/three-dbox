# PLAN — EX-2 Navigation Resolver (adopt Rapier's KinematicCharacterController behind one threshold profile)

> **Created:** 2026-06-19. **Status:** design / plan of record (no runtime code yet).
> **Owns:** the EX-2 "navigation reliability" exit criterion in [`SPRINT-EX-V1.md`](SPRINT-EX-V1.md).
> **Supersedes the approach of:** the EX-2.2 probe-Y attempts (tried + reverted 2026-06-14) and the 2026-06-15 floor-tile / remount deadband patches — symptom fixes; this addresses the structural cause.
> **Decision (2026-06-19):** **borrow, don't build.** The resolver is **Rapier's `KinematicCharacterController`**, which we already ship (`@dimforge/rapier3d-compat`). The HYBRID physics rule is revised to allow kinematic movement *resolution* (never dynamics) — `three-dbox/CLAUDE.md` updated same day.
> **Prereqs read:** [`EX-1-FINDINGS.md`](EX-1-FINDINGS.md), [`PLAN-EX-EXPERIENCE-FLOOR-2026-06-12.md`](PLAN-EX-EXPERIENCE-FLOOR-2026-06-12.md).

---

## 1. Why this exists (the diagnosis — unchanged)

EX-2 has not converged after multiple sessions of constant-tuning. A full-source read (2026-06-19) found the reason: **there is no navigation *system*. Player position is co-written every tick by two subsystems that use different world models and don't know about each other, refereed only by deadband constants scattered across four files.**

### 1.1 The two authorities (verified in source)

| | Vertical authority | Obstacle authority |
|---|---|---|
| Lives in | `@base/player-three` `PlayerController` | `three-dbox` `DboxCharacterEntity` (+ `@base/physics`) |
| Source of truth | top-down raycast (`MeshTerrainSampler.sample`), reduced by `Math.min` of a 5-tap footprint (`sampleTerrainFootprintY`, `PlayerController.ts:380`) | Rapier trimesh dual-sphere overlap (`PhysicsWorld.spherePenetration`) |
| Writes | `character.position.y = groundY + baseYOffset` — **hard snap, no smoothing** (`PlayerController.ts:1543`) | `cy += depth` (step lift) **and** `cx/cz += normal*depth` (wall push) (`DboxCharacterEntity.ts:170`, `:251`) |
| Runs | inside `coordinator.tickPlayer` | `onAfterGameplayTick`, **after** the snap (`DboxSceneModule.ts:467`) |

### 1.2 Two structural consequences (these are the bugs)

1. **No vertical smoothing exists.** Grounding is an instantaneous teleport to whatever the sampler returns this frame. Any per-tick jitter in the sampled floor becomes a visible pop. You are tuning the *inputs* to a snap with zero tolerance for noise — the primary reason calibration can't converge.
2. **Ascent and descent use different mechanisms.** Up-stairs = obstacle authority (`cy += depth` Rapier lift). Down-stairs = vertical authority (the footprint `Math.min` drops Y the instant one tap reaches the lower tread). Two unrelated code paths for one concept; calibrating one regresses the other. This is the EX-2.2 revert in one sentence.

### 1.3 The nature of every fix we tried

| Fix | What it actually did | Type |
|---|---|---|
| `FOOT_PROBE_CLEARANCE = 0.12` | desensitize obstacle authority so it stops catching seams the sampler already grounds | deadband |
| `RAPIER_WALL_MIN_DEPTH = 0.05` | mute shallow pushes "so the sampler can snap down without fighting the push" | deadband |
| probe origin `+1.0` (vs reverted `−0.3`) | tune the sampler ray origin so it re-acquires the floor | input tuning |
| unify spawn to `characterTerrainYOffset` | delete a *third* disagreeing Y-writer (spawn placement) | dedup |
| `mapRoot.updateMatrixWorld(true)` barrier | fix an implicit ordering/timing dependency | sequencing |
| step lift `cy += depth` (full, not `×normalY`) | tune the lift so steps don't undershoot | input tuning |

**None changed the model.** All were referee adjustments or sequencing patches. The knobs are mostly `private static readonly` — not data — so they can't even be swept at runtime.

---

## 2. Decision: borrow Rapier's KinematicCharacterController

We already depend on `@dimforge/rapier3d-compat`. Rapier ships a kinematic character controller that **is** the resolver this plan was going to hand-build. Its one method does collide-and-slide, autostep, snap-to-ground and slope handling in a single pass and returns **one corrected movement vector** — which dissolves the two-writer problem (one input, one corrected output, one write).

```ts
const cc = world.createCharacterController(offset)   // offset ≈ 0.01 skin
cc.enableAutostep(maxStepUp, minStepWidth, false)    // up-stairs
cc.enableSnapToGround(snapDistance)                  // down-stairs / downhill (the MISSING mechanism)
cc.setMaxSlopeClimbAngle(slopeClimbRad)
cc.setMinSlopeSlideAngle(slopeSlideRad)
cc.setUp({ x: 0, y: 1, z: 0 })
// per tick:
cc.computeColliderMovement(capsuleCollider, desiredTranslation)  // desired = (carry+input+gravity)·dt
const corrected = cc.computedMovement()              // collide-and-slide result
// apply `corrected` to character.position + controller.syncPosition; read cc.computedGrounded()
```

`computeColliderMovement` **does not move the collider** — it returns a corrected vector you apply. **Gravity is the caller's job** ("add a downward component to the movement vector"). Both facts mean the carry-impulse model stays the authority: it computes *desired* motion, Rapier only *corrects* it. No dynamics simulation — fully kinematic.

### 2.1 What evaporates (this is the payoff)

| EX-2 problem / would-be `NavigationProfile` field | Rapier KCC equivalent |
|---|---|
| down-stairs pop (the `Math.min` footprint hack) | `enableSnapToGround(distance)` — built in |
| up-stairs lift (`cy += depth`, `maxStepUp`) | `enableAutostep(maxHeight, minWidth, includeDynamic)` |
| `slopeLimitDeg` (35°) | `setMaxSlopeClimbAngle` **+** `setMinSlopeSlideAngle` (a knob we lacked) |
| `skinWidth` / `SWEEP_BACKOFF` (0.02) | `createCharacterController(offset)` |
| wall push + slide (`spherePenetration` + analytic + `computeSlideVelocity`) | collide-and-slide inside `computeColliderMovement` |
| anti-tunnelling (EX-2.1 `shapeCastSphere`) | the solve is **swept by construction** — likely subsumes EX-2.1 |
| two Y-writers reconciled by deadbands | one `computedMovement()` → **one writer** |
| anti-divergent probe origin (reverted EX-2.2) | **gone** — no top-down ray origin to diverge |
| `FOOT_PROBE_CLEARANCE` tile-seam hack | **gone** — capsule solve doesn't catch seams the feet sphere did |
| grounded flag for anim/jump | `computedGrounded()` *(verify exact name vs installed version)* |
| gravity | caller adds downward component — **carry/vertical velocity stays authoritative** |

This converts the biggest, riskiest slice from "build a movement solver" into "wire an existing, battle-tested one," and most accumulated EX-2 patches get **deleted**, not re-tuned.

### 2.2 Reference points (vocabulary is industry-standard)

Godot `CharacterBody3D` (`floor_snap_length`, `max_step_height`, `floor_max_angle`), Unity `CharacterController` (step offset, slope limit, skin width), NVIDIA PhysX, and `BVHEcctrl`'s floating-capsule spring model all expose the same knob set — confirming we are configuring a known component, not inventing one. `BVHEcctrl`'s `floatSpringK`/`floatDampingC` are the best **reference** for the optional smoothing pass (§4.3).

---

## 3. Goals / non-goals

**Goals**
- One authority (Rapier KCC) computes the per-tick corrected movement for map mode. One Y-writer.
- One **data-driven** `NavigationProfile` (§4.1) that configures the KCC (and the procedural sampler) — every knob runtime-tunable, replacing the four scattered owners.
- Smooth stairs/floor via KCC `snapToGround` + `autostep`, with an optional damped post-pass if needed.
- Map-mode adopts KCC; procedural terrain (sandbox, three-dreams) keeps the raycast sampler. Two clean regimes, not two fighting writers.

**Non-goals (this plan)**
- Not changing the carry-impulse *feel* model — carry still computes desired motion. (Revised HYBRID rule: Rapier may **resolve** kinematic movement; it never **simulates** dynamics.)
- Not ladders-in-V1 (Château has none). KCC doesn't do ladders; that's a separate climb mode layered on top later (§4.4) — schema reserves the knobs.
- Not render perf (separate EX track).

---

## 4. Design

### 4.1 `NavigationProfile` — the single config surface

Plain data on `ChampionConfig` (absorbing `ChampionCollisionConfig`), optional per-map override on `MapDescriptorData`. Each field annotated with the KCC setter it drives (or "sampler" for procedural mode).

```ts
export interface NavigationProfile {
  // capsule
  capsuleRadius: number        // KCC character collider + champion.collision.playerRadius
  capsuleHalfHeight: number    // from PLAYER_CAPSULE_HALF_HEIGHT
  footprintRadius: number      // sampler mode only (procedural)

  // KCC tuning
  offset: number               // createCharacterController(offset) ≈ 0.01  (was SWEEP_BACKOFF)
  maxStepUp: number            // enableAutostep(maxHeight, …)
  minStepWidth: number         // enableAutostep(…, minWidth, …)
  snapToGroundDistance: number // enableSnapToGround(distance) — the down-stairs mechanism
  slopeClimbDeg: number        // setMaxSlopeClimbAngle  (was maxWalkableSlopeDeg, 35)
  slopeSlideDeg: number        // setMinSlopeSlideAngle  (new)

  // optional post-correction smoothing (§4.3)
  groundSmoothTime?: number    // 0/undefined = rely on KCC; >0 = damped Y pass

  // carry/slide (kept; carry-impulse model)
  slideFriction: number
  headOnAngleDeg: number
  carryThreshold: number

  // ladder (DESIGNED, deferred — §4.4)
  ladder?: { attachRadius: number; climbSpeed: number; surfaceNormalMaxY: number }
}
```

**Dropped vs the pre-research draft** (KCC makes them unnecessary): `footClearance`, `wallMinDepth`, `probeAbove`, `probeRecoveryClampToLastFloor`, `sweepMinMoveFraction`. Defaults = today's live constants where one exists, so wiring is behaviour-neutral until tuned.

### 4.2 Per-tick flow (map mode)

In `onAfterGameplayTick`, replacing the `DboxCharacterEntity` dual-sphere + the controller's grounded snap, **for map mode only**:

1. Build `desiredTranslation = (carryVelocity + inputVelocity + gravity)·dt` (carry-impulse model unchanged).
2. `cc.computeColliderMovement(capsule, desired, filter)` → `corrected = cc.computedMovement()`.
3. Write once: `character.position += corrected`; `controller.syncPosition(...)`.
4. Read `cc.computedGrounded()` → feed jump reset + animation grounded state (replaces sampler-derived grounded).
5. `?navdebug` logs `computedGrounded` + `numComputedCollisions()`/`computedCollision(i)` per regime.

Sandbox / procedural keep the existing `PlayerController` sampler path untouched (no Rapier trimesh there).

### 4.3 Smoothing

KCC `snapToGround` + `autostep` should make stairs smooth without a manual snap. If owner playtest still sees micro-pops, add a **single damped pass on the applied Y** (`groundSmoothTime`, critically-damped — the `BVHEcctrl` float-spring model) — grounded only, bypassed on teleport/respawn. Decide need at the S1 gate (ND-1); do not pre-build it.

### 4.4 Transition regimes + ladders

KCC reports grounded + per-contact collisions; that's enough for `?navdebug` regime tagging (floor/step/slope/wall) without a hand-rolled state machine. **Ladders are out of KCC's scope** — when needed, a `ladder` climb mode reads `NavigationProfile.ladder`, switches `desiredTranslation` to vertical along the ladder, and bypasses gravity while attached. Post-V1.

---

## 5. Placement (revised HYBRID boundary)

The KCC capsule + per-tick `computeColliderMovement` call are **reusable engine runtime** → `@base/*`. Recommendation:

- Add an optional **`CharacterMover`** to **`@base/physics`** (it already owns Rapier): wraps `KinematicCharacterController`, configured from a `NavigationProfile`, exposing `move(desired): { applied, grounded }`. This keeps Rapier usage in the Rapier package.
- dbox map-mode wires it in place of the `DboxCharacterEntity` Rapier path; `DboxCharacterEntity` keeps the analytic sandbox wall path only (or is retired for map mode).
- `NavigationProfile` type lives with `ChampionConfig` (dbox) for now; promote to `@base/physics` if a second consumer needs it.

**Revised HYBRID rule** (`three-dbox/CLAUDE.md`, updated 2026-06-19): *"`@base/physics` provides a query-only Rapier world **and a kinematic `CharacterMover` (Rapier `KinematicCharacterController`) that resolves collision-corrected movement**. The carry-impulse system still owns desired motion + feel; Rapier never simulates dynamics."*

---

## 6. Migration map (where each current knob goes)

| Today | File | Becomes |
|---|---|---|
| `playerRadius`, `slideFriction`, `headOnAngleDeg`, `carryThreshold` | `champions/doomfist.ts` | `NavigationProfile` |
| `FOOT_PROBE_CLEARANCE`, `RAPIER_WALL_MIN_DEPTH`, `SWEEP_MIN_MOVE_FRACTION`, `SWEEP_BACKOFF`, dual-sphere probe | `DboxCharacterEntity` | **deleted** (KCC subsumes) — except `offset` (= old skin) |
| `probeFromY = max(character.y+1.0, 1.0)` closure | `DboxSceneModule.ts:217` | **deleted** (KCC has no probe origin) |
| `maxWalkableSlopeDeg` | `PlayerController` config | `slopeClimbDeg` → `setMaxSlopeClimbAngle` |
| `MeshTerrainSampler` (map mode) | `DboxSceneModule` | **retired for map mode** (kept for procedural; ND-4) |
| `position.y = targetGroundY` hard snap (map) | `PlayerController.ts:1543` | KCC `computedMovement` applied once |
| EX-2.1 `shapeCastSphere` swept pre-pass | `DboxCharacterEntity` | likely **deleted** (KCC swept by construction; confirm at S0) |

---

## 7. Staged rollout (each slice = one session; owner-playtest gated)

| Slice | Scope | Exit gate | Risk |
|---|---|---|---|
| **S0 SPIKE** | Prove KCC works in our **never-stepped** query world: create a capsule collider + character controller, register Château trimesh, call `computeColliderMovement`, confirm sane non-NaN `computedMovement`, `computedGrounded` reads true on floor, autostep/snap fire. Confirm `updateSceneQueries()` suffices (no `world.step()`). | Headless: returns sane movement + grounded, no NaN. **Go/No-Go on KCC.** If No-Go → fall back to a hand-rolled single-writer resolver (anti-divergent probe + grounded smoothing) built from the §1 diagnosis — the pre-research draft of this plan; reconstruct from the diagnosis if needed. | **highest** — the make-or-break |
| **S1** | Wire `CharacterMover` into dbox map-mode behind `?kcc`. Carry feeds `desired`; apply `computedMovement`; `NavigationProfile` config; `computedGrounded` → jump/anim. A/B `?kcc=0` reverts to current path. | Owner: flat-walk no stumble; stairs up **and** down smooth; full-charge punch into thin walls stops; spawn grounded. | med — flag-gated A/B |
| **S2** | Delete the obsolete patchwork (dual-sphere, `FOOT_PROBE_CLEARANCE`, `RAPIER_WALL_MIN_DEPTH`, probe-Y closure, EX-2.1 sweep, sampler for map-mode) once S1 signs off. Procedural sampler stays. | dbox typecheck clean; map-mode KCC-only; sandbox unaffected. | low–med — removal after proof |
| **S3** | `?navdebug` regime/grounded telemetry; tune `NavigationProfile` live with owner; (optional) damped smoothing pass if ND-1 says so. | Owner maps a glitch → a profile knob; thresholds documented as the tuning surface. | low |
| **S4** | Promote `CharacterMover` + `NavigationProfile` to `@base/physics`; regression-check no other consumer touched (dbox-only adoption, so low). | `@base/*` build + CI green. | low (isolated to dbox) |

S0 is non-negotiable and first — everything rides on KCC behaving in a never-stepped world.

---

## 8. Risks

- **Never-stepped world (S0).** KCC may need the world stepped / queries refreshed. **Precedent:** `shapeCastSphere` returned null until `updateSceneQueries()` was added (memory `reference_rapier_query_world_gotchas`). Same remedy expected; S0 proves it before any commitment.
- **New character collider.** Today we only do ad-hoc query shapes; KCC needs a real capsule collider in the world. Minor wiring, validated in S0.
- **Grounding-model shift** (raycast → capsule-vs-trimesh). The intended change, but a behaviour change → owner-playtest gated.
- **Autostep cost** — Rapier flags it "computationally expensive." One player character; fine. Watch `?perf` draws/frame after S1.
- **`computedGrounded` API name** — verify against the installed `@dimforge/rapier3d-compat` version in S0 (don't assume).
- **KCC supports translation only** (no rotation) — fine; facing stays in `PlayerController`.

---

## 9. Verification strategy

- **Headless (S0, every slice):** build clean; Château map-mode smoke (spawn grounded, `posFinite`, no error console, `computeColliderMovement` returns non-NaN, `computedGrounded` true on floor) with RAF actually running (foreground tab — hidden tab pauses RAF, memory `reference_map_mode_mount_grounding`).
- **Owner playtest (gates):** flat-walk, stairs up+down, full-charge punch into thin walls, remount via Play-Again ×N. Each maps to a slice exit.
- **A/B flag:** `?kcc=0` reverts to the current path live — a regression is one query-param from proof.

---

## 10. Open decisions (resolve at the named gate)

| ID | Decision | Gate | Default |
|---|---|---|---|
| ND-0 | does KCC work in our never-stepped world with `updateSceneQueries()` only? | S0 | assume yes; spike proves |
| ND-1 | rely on KCC `snapToGround` vs add a damped Y smoothing pass | after S1 feel | rely on KCC first |
| ND-2 | capsule dims (radius / half-height) | S0 | `playerRadius` + `PLAYER_CAPSULE_HALF_HEIGHT` |
| ND-3 | `CharacterMover` home: `@base/physics` vs new `@base/locomotion` | S4 | `@base/physics` (already owns Rapier) |
| ND-4 | retire `MeshTerrainSampler` for map-mode entirely vs keep as fallback | S2 | retire for map mode; keep for procedural |
| ND-5 | ladder climb mode | post-V1 | deferred; schema reserved |

---

## 11. One-paragraph summary (for the next session)

EX-2 won't calibrate because two subsystems write the player's Y every tick from different world models (raycast sampler hard-snap vs Rapier feet-sphere lift), reconciled only by scattered deadband constants, with no vertical smoothing. **Resolution: stop hand-building a resolver and adopt Rapier's `KinematicCharacterController`** — already shipped via `@dimforge/rapier3d-compat`, its `computeColliderMovement` does collide-and-slide + autostep + snap-to-ground + slope handling in one pass and returns a single corrected vector (one writer). Carry-impulse still computes desired motion + gravity; Rapier only corrects it (HYBRID rule revised to allow kinematic resolution, never dynamics). A `NavigationProfile` becomes the data-driven config surface that drives the KCC; most accumulated EX-2 patches get deleted. Plan: **S0 spike** proving KCC behaves in our never-stepped world against the Château trimesh (go/no-go) → S1 wire behind `?kcc` with A/B → S2 delete the obsolete patchwork → S3 telemetry + live tuning → S4 promote to `@base/physics`. Every slice owner-playtest gated; map-mode adopts KCC while procedural terrain keeps the sampler.
