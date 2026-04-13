# CLAUDE.md — three-dbox

## What this project IS
A standalone combat sandbox game — OW1 late-era Doomfist physics brawler. Forked from the `threejs-engine-dev` dbox locomotion lab, evolved into a publishable web app.

## What this project is NOT
- Not the engine harness (`threejs-engine-dev` is the workbench)
- Not a narrative game (`three-dreams` handles story content)
- Not a library — it's a leaf application

## Quick orientation

| Path | Purpose |
|------|---------|
| `PROJECT.md` | Vision, design philosophy, architecture overview |
| `ROADMAP.md` | Alpha roadmap — 6 phases from fork to ship |
| `STATE.md` | Current phase, what works, known issues, constants |

### Source
| Path | Purpose |
|------|---------|
| `src/scenes/` | Arena scene descriptors |
| `src/modules/` | DboxSceneModule (orchestrator) |
| `src/modules/dbox/` | DboxLab (abilities), GameplayLabHost, RocketPunchPointer |
| `src/entities/` | DboxCharacterEntity — post-tick collision correction layer |
| `src/collision/` | WallCollider (circle-vs-plane/box, slide math), dboxArenaWalls (geometry + visuals) |
| `src/views/` | DboxView (gameplay), MenuView (nav), SettingsView |
| `public/models/` | dfist_base.glb (Doomfist mesh) |
| `public/characters/` | Animation packs |

## Key conventions

- **link: deps** — all `@base/*` packages resolve via `link:../SHARED/packages/...` (not pnpm workspace protocol)
- **Physics model** — `@base/player-three` PlayerController carry impulse system, NOT Rapier. Terrain sampling for ground. Wall collision via `DboxCharacterEntity` + `WallCollider` (post-tick correction layer — Phase 1 complete).
- **Ability system** — `DboxLab` composes into `DboxSceneModule` via `GameplayLabHost` interface. Abilities use `PlayerController.setPlanarCarryVelocity`, `addPlanarCarryImpulse`, `applyVerticalAbilityImpulse`.
- **Input bindings** — `@base/input` InputModule with `mergeBindings`. Dbox overrides: Q = `ability_primary` (uppercut), E = `ability_secondary` (slam), RMB = rocket punch (custom pointer handler, not InputModule).
- **Camera** — `close-follow` preset via `@base/camera-three`, Tab toggles FPV/TPV.
- **Character** — `dfist_base.glb` Trinity rig. Locomotion clip indices from `animations_base.glb`: idleStand=4, walkFwdStand=6, runFwdStand=3.

## Build & run
```bash
pnpm dev          # Vite dev server
pnpm build        # vue-tsc + vite build
```

## Things to NEVER do
- Modify `@base/*` packages from this project without explicit instruction (they live in `SHARED/packages/`)
- Remove or rename the core `DboxLab` / `GameplayLabHost` interface without updating both sides
- Add narrative/quest content — this is a combat sandbox, not a story game
- Use Rapier for player physics unless migrating away from PlayerController carry system entirely
