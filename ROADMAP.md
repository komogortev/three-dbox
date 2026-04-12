# ROADMAP.md — three-dbox Alpha

Target: **1 polished arena** with physics-driven Doomfist combat loop.
Structure: Separate arenas via menu select (alpha = 1 arena).

---

## Phase 0: Fork & Scaffold — COMPLETE (2026-04-12)

Extracted dbox from `threejs-engine-dev` into standalone project.

- [x] Create `package.json` with `@base/*` link deps
- [x] Copy/adapt: `DboxSceneModule`, `DboxLab`, `RocketPunchPointer`, `GameplayLabHost`
- [x] Copy/adapt: `DboxView.vue`, `MenuView.vue`, `SettingsView.vue`
- [x] Copy scene descriptor (`dbox.ts` + `sandbox.ts` base)
- [x] Copy character asset (`dfist_base.glb`) + animation pack
- [x] Set up router: menu → dbox gameplay → settings
- [x] TypeScript check + Vite build pass clean
- [x] `pnpm install` + `pnpm dev` run clean

---

## Phase 1: Wall Collision & Slide — COMPLETE (2026-04-12)

### Architecture
- `DboxCharacterEntity` — correction layer over PlayerController (post-tick collision resolve)
- `WallCollider` — circle-vs-plane + circle-vs-box primitives, slide velocity math
- `syncPosition()` added to `@base/player-three` PlayerController (minimal API addition)

### What was built
- [x] 80×80m arena boundary walls (4 planes, normals inward)
- [x] 3 angled interior walls (45° NE, 45° SW, 30° mid-west) for slide testing
- [x] 2 box pillars (centre + east)
- [x] Visual meshes with edges for all collision geometry
- [x] Punch wall-slide: glancing (> 30° from normal) → slide with 12% friction; head-on → full stop
- [x] Walking collision: player stops at walls
- [x] NPC blobs bounce off walls (0.6 bounciness coefficient)

### Not yet done (deferred to Phase 1D / polish)
- [ ] Uppercut ceiling clamp
- [ ] Slam arc wall deflection
- [ ] Punch charge visual/audio cue on wall impact
- [ ] Tuning pass (friction, head-on threshold, minimum slide speed)

---

## Phase 2: Character & Input Polish

Champion config drives the character entity. Ability tuning described declaratively so the entity can compute optimally.

- [ ] Define `ChampionConfig` type — ability params, collision tuning, speed, stamina
- [ ] Move DboxLab ability constants into ChampionConfig (punch speed range, CDs, knockback values)
- [ ] CharacterEntity reads config to parameterize collision (slide friction, head-on threshold per ability)
- [ ] Fix character scale issue
- [ ] Input remapping via Settings screen — ability keybinds (Q/E/RMB) configurable
- [ ] Tab camera toggle — verify FPV/TPV both work post-fork
- [ ] Ability feedback: screen shake on punch impact, hit-stop on wall slam
- [ ] Punch charge indicator (visual/audio cue for charge level)
- [ ] Cooldown indicators on HUD
- [ ] Stamina or resource system (optional — evaluate if needed for pacing)

**Exit criterion:** Abilities are config-driven. Controls feel responsive and configurable. Player gets clear feedback on ability state.

---

## Phase 3: Arena Environment

Phase 1 walls are sufficient for testing. This phase enriches the arena for varied play.

- [ ] Design arena layout: mix of walls, pillars, ramps, platforms at varied angles
- [ ] Angled surfaces (ramps) for punch-redirect upward/sideways
- [ ] Elevated platforms reachable via uppercut or slam-arc
- [ ] Replace or extend terrain with authored geometry (GLB or programmatic)
- [ ] Visual pass: materials, lighting that reads well during fast movement
- [ ] Collision geometry matches visual geometry

**Exit criterion:** Arena has enough geometry variety that each ability interacts differently with the environment.

---

## Phase 4: Round Flow & UI

- [ ] Round structure: countdown → play → end condition
- [ ] End condition candidates: timer (survive X seconds), target score (deal X damage), clear all targets
- [ ] HUD: round timer, damage dealt counter, ability cooldown pips
- [ ] Pause menu with restart / return to menu
- [ ] Arena select screen (single entry for alpha, extensible)
- [ ] Results screen (stats summary after round end)

**Exit criterion:** Complete play loop — menu → arena → play → results → menu.

---

## Phase 5: Polish & Ship

- [ ] Audio: punch whoosh, wall impact, uppercut swoosh, slam ground-hit, ambient arena
- [ ] Visual effects: punch trail, impact sparks, slam shockwave ring, uppercut wind
- [ ] Meteor Strike implementation (if scope allows — leap + AoE landing)
- [ ] Performance pass: draw calls, geometry optimization, LOD if needed
- [ ] PWA packaging (`@base/pwa-core`)
- [ ] Deploy target (Vercel / Netlify / static hosting)
- [ ] Final playtest and tuning pass

**Exit criterion:** Publishable alpha — loads fast, plays smooth, has audio/visual juice.

---

## Dependency notes

- Phases 0–1 are strictly sequential (can't test wall-slide without walls, can't have walls without the fork)
- Phase 2 (character polish) benefits from Phase 1 walls as test surfaces
- Phase 3 (arena) builds on tuned character to design geometry that rewards ability use
- Phase 4 depends on Phase 2 (arena must exist for round flow to make sense)
- Phase 5 is the final pass after all mechanics are working
