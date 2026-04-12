# three-dbox

Combat sandbox inspired by OW1 late-era Doomfist. Built on the `@base` game platform (Vue 3 + Three.js).

## Features

### Working (inherited from engine-dev)
- Doomfist-style character with locomotion animations
- Rocket Punch (RMB charge/release) — 78–152 m/s carry velocity
- Rising Uppercut (Q) — vertical launch + forward carry, cone-hits NPCs
- Seismic Slam (E hold/release) — mouse-aimed cone, dash-to-apex + slam-down AoE
- Skim-jump (Space during punch) — extends punch into aerial arc
- FPV / TPV camera toggle (Tab)
- Time control (pause, step-frame, slow-mo)
- 5 NPC blobs with physics reactions
- Input settings with configurable bindings

### Planned (alpha)
- Wall collision and punch wall-slide mechanics
- Enclosed arena with walls, pillars, ramps
- Round flow (start/play/end loop)
- Damage and health system
- Audio and visual effects

## Setup

Requires the `@base` monorepo workspace at `E:/Projects/`.

```bash
pnpm install
pnpm dev
```

## Controls

| Input | Action |
|-------|--------|
| WASD | Move (5.5 m/s) |
| Shift | Sprint |
| Space | Jump (or skim-jump during punch) |
| C | Crouch |
| RMB hold/release | Rocket Punch (charge up to 1.4s) |
| Q | Rising Uppercut |
| E hold/release | Seismic Slam (aim cone, release to fire) |
| Tab | Toggle FPV / TPV camera |
| P | Pause |
| F | Step one frame |
| [ / ] | Slow down / speed up |

## Docs

- [PROJECT.md](./PROJECT.md) — Vision and architecture
- [ROADMAP.md](./ROADMAP.md) — Alpha roadmap (6 phases)
- [STATE.md](./STATE.md) — Current state and known issues
