# STATE.md — three-dbox

## Current phase

**Phase 2: Character & Input Polish** — IN PROGRESS (2026-04-12).
Phase 1: Wall Collision & Slide — COMPLETE (2026-04-12).

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

## Known issues

- Character scale fixed: `modelFitHeight` set to 2.1 m (OW1 Doomfist ~7 ft), was inheriting sandbox Remy 1.78 m
- Wall collision IMPLEMENTED — arena boundary walls + angled interior walls + pillars + slide mechanics
- NPC blobs collide with walls (bounce) but have no health/damage system
- Meteor Strike not implemented
- Arena has 80×80m boundary walls, 3 angled interior walls, 2 pillars
- Input remapping for abilities not exposed in settings UI

## Blockers

None. Phase 2 (Character & Input Polish) is next.

## Assets inventory

| Asset | Path | Notes |
|-------|------|-------|
| Doomfist mesh | `public/models/dfist_base.glb` | Trinity rig, meshopt + WebP |
| Locomotion anims | `public/characters/npc/animations_base.glb` | Shared pack, indices: idleStand=4, walkFwdStand=6, runFwdStand=3 |

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
