# PROJECT.md — three-dbox

## Vision

OW1 late-era Doomfist combat sandbox. The kit defines both movement and combat — Rocket Punch isn't just damage, it's traversal. Wall interactions shape the entire feel. The goal is a publishable web app where a player enters an arena and experiences that brawler physics loop: charge, launch, slide, slam, repeat.

## Design philosophy

- **Movement IS combat.** Every ability displaces the player. Punch travels, uppercut rises, slam arcs. The arena is a physics playground.
- **Walls matter.** Punch into a wall at an angle = slide deflection that redirects momentum. Head-on = full stop + impact. This is the core feel.
- **Iterative polish.** Start with one polished arena. Get the physics feel right before adding content. Surfaces and collision response come before visual effects.
- **Separate arenas.** Each arena is an isolated scene selected from a menu. Alpha ships with one.

## What this project IS

A standalone game fork of `threejs-engine-dev`, extracting and extending the dbox locomotion lab into a publishable combat sandbox. Consumes `@base/*` shared packages from the monorepo.

## What this project is NOT

- Not the engine harness — that stays in `threejs-engine-dev`
- Not a narrative game — that's `three-dreams`
- Not a library — it's a leaf application

## Current state

**Phase 3 complete (2026-06-09) → Phase 4 round flow in progress.** Phase 1 ✅ (2026-04-12) · Phase 2 partial — HUD ✅, remainder deferred behind Phase 3 · Phase 3 ✅ — OW map pipeline (Château Guillard GLB + Rapier trimesh via `@base/physics`), arena registry, health-pack substructure, spawn calibration · T-B17 round structure ✅ (2026-06-09). Live tracking: [STATE.md](./STATE.md) · plan of record: [docs/ASSESSMENT-2026-06-10.md](./docs/ASSESSMENT-2026-06-10.md).

| Ability | Input | Behavior | CD |
|---------|-------|----------|----|
| Rocket Punch | RMB hold/release | Charge 0–1.4s, launch at 78–152 m/s facing direction, small vertical lift | 4s |
| Rising Uppercut | Q | Forward + upward impulse, cone-hits nearby NPC blobs (0.6s lock) | 6s |
| Seismic Slam | E hold/release | Mouse-aim cone preview, dash to apex + downward slam, AoE knockback on blobs | 6s |

Character: `dfist_base.glb` (Doomfist-style mesh, Trinity rig, meshopt + WebP).
Environment: two arenas via menu — Château Guillard (OW1 map GLB, Rapier trimesh collision) and the sandbox calibration arena (80×80m walls, ramps, pool, 5 NPC blobs).
Camera: FPV/TPV toggle via Tab.
Time control: pause, step-frame, slow-mo (P/F/R/[/]).

### What works

- Punch carry velocity feel — speed and decay tuning is solid
- Uppercut + slam cone targeting — mouse-aimed slam with terrain raycast
- NPC blob physics — blobs react to uppercut lift, slam knockback, and wall bounce
- Skim-jump off punch (space during carry) — extends punch travel into arc
- **Wall collision** — punch at angle → slide deflection with 12% friction; head-on → full stop
- Arena boundary walls (4 planes) + angled interior walls (3) + pillars (2) with visual edge meshes

### What's missing for game feel

- ~~**No ChampionConfig**~~ — DONE: `src/champions/ChampionConfig.ts` + `doomfist.ts`
- ~~**Input remapping for abilities**~~ — DONE: settings bindings flow into HUD labels dynamically
- **HUD overlay** — DONE (2026-04-13): health bar + ability cooldown display, settings-aware key labels
- **No damage/health system.** Blobs react to physics but have no HP. HUD shows dummy 250/250 health.
- ~~**No round structure.**~~ — DONE (T-B17, 2026-06-09): countdown → 60s round → end screen. Results stats still pending (needs health/damage system — see `docs/ASSESSMENT-2026-06-10.md`).
- **Meteor Strike not implemented.** Three abilities only.

## Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Vue 3 + Vite | SPA, vue-router for menu/gameplay/settings |
| 3D Engine | Three.js 0.172 via `@base/threejs-engine` | ThreeModule lifecycle |
| Physics | `@base/player-three` PlayerController + `@base/physics` (Rapier 0.14, query-only) | Hybrid: carry impulse + terrain sampling drive movement; Rapier trimesh answers wall/step queries on OW maps — no Rapier dynamics |
| Collision | `src/collision/WallCollider.ts` | Sandbox-mode analytic walls: circle-vs-plane + circle-vs-box, slide math |
| Character | `src/entities/DboxCharacterEntity.ts` | Post-tick correction layer — dual-sphere Rapier probe + step-climb (map mode), analytic resolve (sandbox) |
| Input | `@base/input` InputModule | Keyboard + gamepad, pointer lock, configurable bindings |
| Camera | `@base/camera-three` | Close-follow preset, FPV/TPV toggle |
| Scene | `@base/scene-builder` SceneDescriptor | Terrain + atmosphere + character config |
| Abilities | `DoomfistLab` (local, implements `IAbilityLab`) | Composed into `DboxSceneModule` via `GameplayLabHost`; lab interface enables future champions |
| Maps | `src/maps/MapDescriptor.ts` + `src/arenas/registry.ts` | Data-first per-map descriptor (spawns, physics filters, display overrides, health packs); 2-file map onboarding |
| Round | `src/round/RoundManager.ts` | countdown→playing→ended state machine, sim-time ticked, polled by `DboxView` |

## Alpha scope

Single polished arena with full physics-driven combat loop. See [ROADMAP.md](./ROADMAP.md).

## Post-alpha vision

- Multiple arenas via menu select (different geometry, different tactics)
- Scoring and timer (damage dealt, targets hit, round completion)
- Meteor Strike (ultimate ability)
- Environment hazards (moving platforms, breakable walls)
- Leaderboard / personal bests
