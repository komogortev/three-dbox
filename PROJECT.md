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

**Pre-fork.** The dbox scene lives in `threejs-engine-dev` as a locomotion lab. Three abilities are implemented and tested:

| Ability | Input | Behavior | CD |
|---------|-------|----------|----|
| Rocket Punch | RMB hold/release | Charge 0–1.4s, launch at 78–152 m/s facing direction, small vertical lift | 4s |
| Rising Uppercut | Q | Forward + upward impulse, cone-hits nearby NPC blobs (0.6s lock) | 6s |
| Seismic Slam | E hold/release | Mouse-aim cone preview, dash to apex + downward slam, AoE knockback on blobs | 6s |

Character: `dfist_base.glb` (Doomfist-style mesh, Trinity rig, meshopt + WebP).
Environment: 100x100m terrain with pool, 5 landing-tier ramps (2–22m), knee/body obstacles, 5 NPC blobs.
Camera: FPV/TPV toggle via Tab.
Time control: pause, step-frame, slow-mo (P/F/R/[/]).

### What works well

- Punch carry velocity feel — speed and decay tuning is solid
- Uppercut + slam cone targeting — mouse-aimed slam with terrain raycast
- NPC blob physics — blobs react to uppercut lift and slam knockback
- Skim-jump off punch (space during carry) — extends punch travel into arc

### What's missing for game feel

- **No wall collision.** Punch travels through everything — no wall-slide, no impact stop. This is the #1 gap.
- **No arena walls/pillars.** Environment is open terrain. Need enclosed surfaces.
- **No damage/health system.** Blobs react to physics but have no HP.
- **No round structure.** Freeform sandbox — no start/end/scoring.
- **Meteor Strike not implemented.** Three abilities only.

## Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Vue 3 + Vite | SPA, vue-router for menu/gameplay/settings |
| 3D Engine | Three.js 0.172 via `@base/threejs-engine` | ThreeModule lifecycle |
| Physics | `@base/player-three` PlayerController | Carry impulse + terrain sampling (not Rapier) |
| Input | `@base/input` InputModule | Keyboard + gamepad, pointer lock, configurable bindings |
| Camera | `@base/camera-three` | Close-follow preset, FPV/TPV toggle |
| Scene | `@base/scene-builder` SceneDescriptor | Terrain + atmosphere + character config |
| Abilities | `DboxLab` (harness-local) | Composed into `DboxSceneModule`, uses `GameplayLabHost` interface |

## Alpha scope

Single polished arena with full physics-driven combat loop. See [ROADMAP.md](./ROADMAP.md).

## Post-alpha vision

- Multiple arenas via menu select (different geometry, different tactics)
- Scoring and timer (damage dealt, targets hit, round completion)
- Meteor Strike (ultimate ability)
- Environment hazards (moving platforms, breakable walls)
- Leaderboard / personal bests
