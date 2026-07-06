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
| `src/modules/dbox/` | DoomfistLab (abilities, implements IAbilityLab), GameplayLabHost, RocketPunchPointer |
| `src/entities/` | DboxCharacterEntity — post-tick collision correction layer (analytic + Rapier dual-sphere) |
| `src/collision/` | WallCollider (circle-vs-plane/box, slide math), dboxArenaWalls (geometry + visuals) |
| `src/maps/` | MapDescriptor (data-first schema + compiler) + per-map descriptors (chateauGuillard) |
| `src/arenas/` | Central arena registry — MenuView/DboxView derive from it; 2-file map onboarding |
| `src/items/` | Health pack extractor (OWLib entity nodes) + manager (rotation/pickup/respawn) |
| `src/round/` | RoundManager state machine (countdown→playing→ended) + snapshot types |
| `src/champions/` | ChampionConfig type + doomfist.ts tuning values |
| `src/views/` | DboxView (gameplay + overlays), MenuView (arena select), SettingsView |
| `public/models/` | dfist_base.glb (Doomfist mesh) |
| `public/characters/` | Animation packs |
| `public/maps/` | OW map GLBs (chateau-guillard.glb, draco+webp) |
| `docs/` | Assessment + fix-plan docs — current plan of record: ASSESSMENT-2026-06-10.md |

## Key conventions

- **link: deps** — all `@base/*` packages resolve via `link:../SHARED/packages/...` (not pnpm workspace protocol)
- **Physics model — HYBRID** — `@base/player-three` PlayerController carry impulse system owns **desired** movement + feel (never Rapier *dynamics*). `@base/physics` provides a query-only Rapier world: today, OW-map trimesh wall/step probes in `DboxCharacterEntity` (dual-sphere `spherePenetration`, step-climb on `normal.y > 0.3`). **Planned (EX-2, `docs/PLAN-EX-NAV-RESOLVER-2026-06-19.md`): a kinematic `CharacterMover` (Rapier `KinematicCharacterController`) that collision-*resolves* carry-driven motion in map mode — resolution, not dynamics; carry still computes the desired vector + gravity.** Sandbox arenas use analytic `WallCollider` planes/boxes. Ground = `MeshTerrainSampler` (maps) / `CalibrationTerrainSampler` (sandbox).
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
- Replace the PlayerController carry system with Rapier **dynamics** — `@base/physics` is query / kinematic-resolution only and **never simulates rigidbody dynamics or gravity**; movement feel lives in the carry impulse system. (Rapier's kinematic `KinematicCharacterController` for *collision resolution* of carry-driven motion is allowed — see `docs/PLAN-EX-NAV-RESOLVER-2026-06-19.md`.)
