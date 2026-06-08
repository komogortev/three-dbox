# STATE.md — three-dbox

## Current phase

**Phase 2: Character & Input Polish** — IN PROGRESS (2026-04-13), **DEFERRED** pending Phase 3 physics foundation.
**Phase 3: OW Map + Physics** — IN PROGRESS (2026-06-07). T-B13 ✅ T-B14 ✅ T-B15 ✅ T-B16 ✅. **OW map POC COMPLETE (2026-06-08)** — floor sampler + mesh filter stable; wall penetration + stair snag + spawn calibration deferred. **T-B17 round structure next** (after wall/stair polish pass).
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
- [x] OW map GLB pipeline: Château Guillard (Open3DLab → gltf-transform draco+webp → 8.8MB, `public/maps/chateau-guillard.glb`)
- [x] Rapier trimesh collision: `DboxSceneModule` loads map → `PhysicsWorld.addStaticMesh()` with `smd_bone_vis` filter → `spherePenetration` in `DboxCharacterEntity` (walls only, `|normalY| < 0.7`)
- [x] Scene cleanup in OW map mode: sandbox geometry (grid/platforms/pool), NPC blobs, analytic arena walls, and fixture legend panel all suppressed; `useSandboxScene()` hook + `spawnBlobs` opt
- [x] Terrain sampler: `MeshTerrainSampler` with `() => Math.max(character.position.y + 1.0, 1.0)` — probe from 1 m above character (tracks player elevation for multi-level geometry) with a floor clamp at Y=1.0 (self-corrects below-floor states; at spawn character.y≈0 → probe=1.0 = proven baseline). Rooftop (Y≈81.5) unreachable until character.y > 80.5. Ceilings auto-skipped (Three.js FrontSide). Spawn at `(30, −15)` east-wing interior, `floorY=−0.969`, `spawnY=−0.119`
- [x] OWLib technical mesh filter: `smd_bone_vis` excluded from Rapier + sampler; ≤8-tri spawn/trigger quads hidden (kept in terrain); material-type filter `/\b(13A|9F|9C|9A|B2|10F|F0)_/` hides effect volumes; count logged via `console.debug` at load
- [x] Arena select menu: `MenuView` with Château Guillard (violet) + Sandbox (cyan) buttons; route via `?arena=chateau-guillard` query param

## Known issues

- Character scale fixed: `modelFitHeight` set to 2.1 m (OW1 Doomfist ~7 ft), was inheriting sandbox Remy 1.78 m
- **Wall collision gap** — Rapier `spherePenetration` resolves walls but character can still walk through thin walls into tech/exterior area. Needs capsule sweep or tighter sphere radius tuning next session.
- **Stair navigation gets stuck** — step height detection is too strict; character snags on stair geometry instead of stepping up cleanly. Needs `terrainYOffset` / step-climb tolerance tuned.
- **Spawn point calibration deferred** — coordinates `(30, −15)` are heal-powerup spawn locations, not player start. Character spawn calibration is a dedicated follow-up task.
- NPC blobs collide with walls (bounce) but have no health/damage system
- Meteor Strike not implemented
- Arena has 80×80m boundary walls, 3 angled interior walls, 2 pillars
- Input remapping for abilities not exposed in settings UI
- `PlayerController.isLandingTooHigh()` fires for any landing surface > 0.85 m above takeoff ground — prevents clean Uppercut landing on upper floors (secondary, ground-floor gameplay unaffected)

## Blockers

No current blockers. **T-B17 round structure** is next after wall/stair polish.

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
| 2026-06-07 | **T-B14 + T-B15 + T-B16 SHIPPED.** Château Guillard GLB acquired (Open3DLab, 136MB → 8.8MB draco+webp). `DboxSceneModule` loads map, adds Rapier trimesh (smd_bone_vis filter), uses flat Y=0 terrain sampler (OW map floor ≈ Y=0), `spherePenetration` handles walls. `DboxCharacterEntity` had missing `import * as THREE` (silent ReferenceError crash) — fixed. Arena select menu: `MenuView` Château Guillard (violet) + Sandbox (cyan), `DboxView` reads `?arena=` query param. |
| 2026-06-07 | **T-B16 cleanup pass.** Scene in OW map mode now fully sanitized: `useSandboxScene()` hook skips sandbox geometry; `spawnBlobs: !mapLoaded` opt skips NPC blobs; analytic arena wall planes/meshes replaced with empty arrays; fixture legend panel hidden via `!arenaId`. Terrain sampler upgraded from flat Y=0 to `MeshTerrainSampler` (Three.js CPU raycast from Y=5 → hits Château Guillard ground floor at Y≈−0.56, skipping rooftops at Y≈81+). All 3 abilities confirmed working in map mode (Rising Uppercut: 11.05m arc). |
| 2026-06-08 | **Interior spawn + OWLib mesh filtering complete.** Root cause of spawn-to-roof: `MeshTerrainSampler` probed from Y=500, hitting rooftop first every tick. Fix: `probeFromY=1.0` skips rooftop/box-tops, finds interior floor at Y=−0.969. `syncPosition` only writes internal delta state (NOT `character.position`) — must set both. OWLib technical meshes: ≤8-tri quads hidden-but-kept (floor detection); emissive/effect type prefixes (`13A_`/`9F_`/`9C_`/`9A_`/`B2_`/`10F_`/`F0_`) hidden. Remaining amber glass + protest banners are legitimate Château Guillard visual elements (`0_` standard material). |
| 2026-06-08 | **Floor sampler made character-relative — settled on `max(y+1, 1)` probe.** `probeFromY=1.0` missed floors above Y=1.0. `y-0.5` broke self-correction (probe below floor → missed → stuck). `y+2.0` found intermediate tech meshes at spawn (character.y=0, probe=2.0 hit wall-cap geometry). `y+1.0` is the correct balance: at spawn probe=max(1,1)=1.0 (identical to proven baseline, finds −0.969 interior floor), during navigation probe clamps to 1.0, on elevated surfaces tracks player up. `MeshTerrainSampler.probeFromY` accepts `number \| (() => number)` callback. Brick/architectural meshes were always in both Rapier + terrainMeshes; collision lists were never the bug. |
| 2026-06-08 | **OWLib material filter regex fixed.** Previous regex `/:(13A\|9F\|9C\|9A\|B2\|10F\|F0)_/` required a colon before the type code. OWLib GLB material names use `TypeCode_Hash` format (no colon), e.g. `13A_81B09AB0F566B1D2`. Fixed to `/\b(13A\|9F\|9C\|9A\|B2\|10F\|F0)_/` — word boundary fires at start-of-string and after non-alphanumeric separators without matching embedded hex substrings. Added `hiddenTechCount` debug log at load to confirm filter is working. |
| 2026-06-08 | **Iteration planning session — Tier 1 polish targets + scaling architecture locked.** Three blockers before T-B17: (1) Wall penetration — upgrade `DboxCharacterEntity` Rapier probe from single sphere to dual-sphere (feet + head) to catch thin exterior walls that single-centre probe misses; both `resolveCollision` and `resolveWalkingCollision` need updating. (2) Stair snag — if Rapier hit `normal.y > ~0.3` (shallow ramp / short step), snap player Y up by `depth × normal.y` instead of pushing XZ; preserves horizontal momentum. (3) Spawn calibration — `(30,−15)` confirmed heal-powerup locations, not player start; validated interior coords needed. Debug leftover found: `console.log("raycast", this)` at `DboxLab.ts:276` — fires every slam hold tick. Architecture for scaling: `MapDescriptor` interface consolidates per-map spawn coords + OWLib filter + mesh exclusion (moves hardcoded spawn+filter out of `DboxSceneModule.onMount`); `IAbilityLab` interface enables multi-champion (`DboxLab → DoomfistLab` rename, `DboxSceneModule` holds `IAbilityLab`); NPC enemy spawn positions flow from `MapDescriptor`. |
| 2026-06-08 | **OW map POC declared complete.** Floor collision + sampler stable; character navigates interior, all 3 abilities functional. Deferred to next session: wall penetration gaps (character can walk into tech/exterior area through thin walls), stair snag (step-climb tolerances too strict), spawn calibration (confirmed (30,−15) coords are heal-powerup locations, not player start). T-B17 round structure follows wall/stair polish. |
| 2026-06-07 | **Château Guillard interior spawn.** Floor/ceiling probes mapped topology: teal = outdoor courtyard (floor=−0.97, open sky), exterior box top (floor≈0, no walls). Both teal courtyard AND interior rooms share mesh `Submesh_2E0BE39370E446C37001` at floor=−0.97 — cannot distinguish by mesh name alone. Position (30,−15) visually confirmed as interior room (purple floor, tight walls N+E). `MAP_SPAWN_PROBE_XZ` reordered with (30,−15) first. Debug helpers `__teleport`/`__enclosure` removed. |
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
