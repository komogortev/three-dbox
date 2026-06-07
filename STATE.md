# STATE.md — three-dbox

## Current phase

**Phase 2: Character & Input Polish** — IN PROGRESS (2026-04-13), **DEFERRED** pending Phase 3 physics foundation.
**Phase 3: OW Map + Physics** — STARTED (2026-06-07). T-B13 `@base/physics` COMPLETE. T-B14 blocked (offline Blender session required).
Phase 1: Wall Collision & Slide — COMPLETE (2026-04-12).

### Phase 2 progress (2026-04-13)

- [x] **HUD overlay** — OW1-style bottom-center bar: character portrait ("D" placeholder) + health bar (left), 4 ability slots with cooldown sweep/numbers (right)
- [x] **Dynamic key labels** — HUD reads active bindings from settings, not hardcoded keys
- [x] HUD architecture: DboxLab.getHudAbilities() → DboxSceneModule.getHudSnapshot() → DboxView rAF poll → DboxHud.vue (pure display, no game logic)
- [x] Dummy health (250/250) + shields (0/150) ready for real health system
- [ ] Health/damage system
- [ ] Visual effects for abilities (punch trail, slam impact, uppercut arc)
- [ ] Crosshair

Forked from `threejs-engine-dev` dbox locomotion lab into standalone project.
- 26 source files, 2 GLB assets (dfist_base.glb 1.5MB, animations_base.glb 728KB)
- `@base/*` packages linked via `link:../SHARED/packages/...`
- TypeScript check + Vite build both pass clean
- Routes: `/` (menu), `/dbox` (gameplay), `/settings`

## What works

- [x] Doomfist character loads and animates (dfist_base.glb + animations_base.glb)
- [x] WASD movement at 5.5 m/s + Shift sprint + Space jump + C crouch
- [x] Rocket Punch: RMB hold 0–1.4s → release → launch at 78–152 m/s + small vertical lift
- [x] Rising Uppercut: Q → forward + upward impulse, cone-hits nearby blobs (0.6s lock)
- [x] Seismic Slam: E hold → mouse-aim cone preview → release → dash to apex + slam down AoE
- [x] Skim-jump: Space during punch carry → extends travel into arc
- [x] 5 NPC blobs react to uppercut (lift + lock) and slam (knockback)
- [x] Camera FPV/TPV toggle via Tab
- [x] Time control: P pause, F step-frame, R resume, [ ] slow/fast
- [x] Terrain: 100x100m with pool, 5 landing ramps (2–22m), obstacles (knee/body height)
- [x] Input settings: configurable bindings, pointer lock
- [x] HUD overlay: health bar + ability cooldown display (bottom-center)

## Known issues

- Character scale fixed: `modelFitHeight` set to 2.1 m (OW1 Doomfist ~7 ft), was inheriting sandbox Remy 1.78 m
- Wall collision IMPLEMENTED — arena boundary walls + angled interior walls + pillars + slide mechanics
- NPC blobs collide with walls (bounce) but have no health/damage system
- Meteor Strike not implemented
- Arena has 80×80m boundary walls, 3 angled interior walls, 2 pillars
- Input remapping for abilities not exposed in settings UI

## Blockers

**T-B14 OW map GLB** — offline Blender session required to acquire and export Château Guillard or Ecopoint: Antarctica. Blocks T-B15 (Rapier trimesh wiring) and therefore blocks Phase 2 close (health/damage numbers and hit-stop feel depend on real map geometry). T-B16 (arena select menu stub) can proceed without it.

## Roadmap restructure (2026-06-06)

Original roadmap (Phases 0–5) updated — two new phases inserted after assessment:

- **Phase 2 close** — 5 remaining items: health/damage system, crosshair, screen shake/hit-stop (T-B10), ability remapping in settings, uppercut ceiling clamp (Phase 1 deferred)
- **Phase 2B (new)** — Ability completeness: Hand Cannon (T-B8), Passive: The Best Defense (T-B9), ability combos (T-B11), Meteor Strike (optional)
- **Phase 3 reframed** — OW map GLB pipeline (Château Guillard / Ecopoint: Antarctica) + `@base/physics` Rapier package; replaces hand-authored arena geometry
- **Phase 4** — Round flow (unchanged)
- **Phase 5** — Polish + sound (T-B12) + PWA ship (unchanged)

New targets: T-B13 `@base/physics` package · T-B14 OW map GLB pipeline · T-B15 Rapier trimesh collision in dbox · T-B16 Arena select menu · T-B17 Round structure · T-B18 Results screen

## Assets inventory

| Asset | Path | Notes |
|-------|------|-------|
| Doomfist mesh | `public/models/dfist_base.glb` | Trinity rig, meshopt + WebP |
| Doomfist alt | `public/models/dfist.glb` | Earlier export, untracked |
| Doomfist armored | `public/models/dfist_armored.glb` | Armored skin, untracked |
| Locomotion anims | `public/characters/npc/animations_base.glb` | Shared pack, indices: idleStand=4, walkFwdStand=6, runFwdStand=3 |

## Decision log

| Date | Decision |
|------|----------|
| 2026-06-06 | **Roadmap restructured.** Phase 2B (ability completeness) inserted between Phase 2 and Phase 3. Phase 3 reframed: OW map GLB (Château Guillard from Open3DLab as Track 1; Ecopoint via OWLib as Track 2) + `@base/physics` Rapier wrapper package. Original Phase 3 hand-authored arena geometry replaced by real OW map with Rapier trimesh collision. |
| 2026-06-07 | **T-B13 `@base/physics` SHIPPED.** `SHARED/packages/physics/` — `PhysicsWorld.create()` async factory (Rapier 0.14.0, module-level WASM init guard), `addStaticMesh(root: THREE.Object3D)` merges all Mesh children into a single fixed-body Rapier trimesh with world transforms applied, `spherePenetration(center, radius)` uses `world.projectPoint()` — exact drop-in contract for existing `CollisionResult` pattern in `DboxCharacterEntity`. Pure `tsc` build, WASM stays behind package boundary. |
| 2026-06-07 | **Phase 2 close deferred until after Phase 3 physics lands.** Health/damage numbers, hit-stop duration, and ability wall-reaction feel will all be affected by how Rapier responds to the OW map's geometry. Shipping Phase 2 now would require a second tuning pass after physics integration — skip Phase 2 and go Phase 3 first to avoid rework. Phase 2 items remain queued; resume after T-B15 is wired and testable. |
| 2026-06-06 | **`@base/physics` Rapier package architecture locked (planning only, no code).** Engine-agnostic public API (`PhysicsWorld`, `ColliderBuilder`, `ShapeCastResult`/`ColliderHandle` types). Rapier types hidden behind package boundary. Hybrid integration mode: Rapier owns collision geometry queries, `PlayerController` carry impulse system unchanged. `DboxCharacterEntity` gets optional `PhysicsWallCollider` param; falls back to existing plane/box math when absent. `PhysicsWorld.create()` async factory + `ColliderBuilder.fromGltfRoot()` + `overlapTest()` are the core query surface. |
| 2026-06-06 | **OW map asset pipeline planned (planning only, no code).** Track 1 (fastest): Château Guillard from Open3DLab → Blender → GLB export (`--compress draco`, not meshopt) → `public/maps/`. Track 2 (canonical): Ecopoint: Antarctica via OWLib DataTool + io_scene_owm Blender addon → same GLB pipeline. Ecopoint preferred as it is Doomfist's canonical lore arena. Boundary walls remain as analytic `WallPlane[]`; interior GLB geometry handled by Rapier trimesh. |

## Key constants (from DboxLab.ts)

| Constant | Value | Notes |
|----------|-------|-------|
| Punch CD | 4s | |
| Uppercut CD | 6s | |
| Slam CD | 6s | |
| Punch charge max | 1.4s | |
| Punch speed range | 78–152 m/s | Shaped charge curve (power 1.12) |
| Punch self-lift Vy | 1.65–3.15 | Scales with charge |
| Uppercut forward | 4 m/s | Carry impulse |
| Uppercut up | 26 m/s | Replace blend (wins over gravity) |
| Slam down | -24 m/s | Replace blend |
| Slam cone range | 7.25m | |
| Slam cone angle | 86 deg | |
| Carry decay | 8 /s | Exponential decay on planar carry |
| Skim-jump min carry | 22 m/s | Threshold to activate during punch |
