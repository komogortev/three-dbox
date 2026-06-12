# three-dbox — Spawn System V1 Plan (2026-06-10)

> Scope: **SP-1** decouple player spawn data from health-pack entities · **SP-2** instant respawn with spawn-point rotation on player death.
> Companion to `ASSESSMENT-2026-06-10.md` — splices into its A/B sequencing (SP-1 rides the Tier A session, SP-2 rides the B1 session).
> **Locked decision (2026-06-10):** V1 = instant respawn with rotation. Death cam / kill feed = Phase 5 polish.

## 1. Problem statement

Findings from the 2026-06-10 spawn-scoping session (code-verified):

- **Spawn selection is random-per-mount, not rotation** — `DboxSceneModule.onMount()` picks a random `spawnPoints` entry once, inline (`DboxSceneModule.ts:146-157`). No respawn path exists.
- **Data coupling** — 2 of 4 spawn points (`mainhall-interior-west (12.8,−12.3)`, `mainhall-interior-east (23.6,−12.1)`) are the XZ coordinates of `37C2` entity nodes — the *confirmed health packs* (descriptor `corridor` rotation group, ×2 instances). A third (`otherparts-ground-east`, `08EB`) is another item-marker entity. Root cause: the 2026-06-09 calibration used ground-level *item entity markers* as spawn candidates because the true spawn volumes couldn't be located. The schema (`spawnPoints` vs `healthPacks`) is already decoupled; only the authored data is not.
- **Counter coupling** — `spawnCount` (`DboxSceneModule.ts:52`) sounds like player-spawn state but drives *health-pack* rotation (inert anyway — assessment F1, fix A2).
- **Player death is undefined** — no damage source, no HP store, no HP≤0 handler. The assessment's B1 specifies blob KO (OD-2) but never says what happens at player HP 0. SP-2 is that answer.
- **Opportunity** — entity `0345` (OW spawn-volumes, ×2 annotated) was written off as "cannot locate via debugMarkers". True but incomplete: `debugMarkers` only surveys ≤8-tri *meshes*; 0345 nodes are pure EMPTYs. The `HealthPackExtractor` technique (name-match parent `Object3D` via `^00000000<TypeHex4><Instance3>$`, read `getWorldPosition`) works on EMPTY nodes — no mesh needed.
- **Y ambiguity to resolve** — STATE/descriptor comments disagree on whether the 37C2 pack nodes sit at ground level ("corridor, ground floor" in spawn comments) or upper corridors (2026-06-08 survey note). The extractor already logs slot positions at load; one launch answers it.

## 2. SP-1 — Decouple spawn data *(no dependencies; bundle with Tier A session)*

### SP-1.1 Generic entity node scan

New `src/maps/entityScan.ts` (~50 lines):

```ts
export interface EntityNode {
  entityType: string   // 4-hex, uppercased
  instance: number
  position: THREE.Vector3   // world space
}
export const ENTITY_NODE_RE = /^00000000([0-9A-Fa-f]{4})(\d{3})$/
export function extractEntityNodes(root: THREE.Object3D, types?: string[]): EntityNode[]
```

- Traverse + name-match + `getWorldPosition` — lifted from `HealthPackExtractor`. `types` omitted → all entity nodes (caller filters; Château has ~5476 EMPTYs, so callers should pass types).
- Caller must ensure `root.updateWorldMatrix(true, true)` first (same contract as today).

Refactor `src/items/HealthPackExtractor.ts` to consume it — **public signature `extractHealthPackSlots(root, slotDefs)` unchanged**, internally maps `EntityNode[]` → `ExtractedSlot[]` (group/size join, sort, debug log preserved). `HealthPackManager` untouched.

### SP-1.2 debugMarkers extension — EMPTY-entity spheres

The original calibration gap was tooling: EMPTYs were invisible to the survey. Close it:

- `MapDescriptorData` + runtime `MapDescriptor`: add `debugEntityTypes?: string[]` (pass-through in `compileMapDescriptor`).
- `DboxSceneModule.renderDebugMarkers()`: when `debugEntityTypes` present, run `extractEntityNodes(mapRoot, debugEntityTypes)` → magenta spheres (distinct from the green mesh-quad markers) + `[entity]` console.debug lines with type/instance/position.

### SP-1.3 The 0345 survey *(live step, ~15 min)*

1. Temporarily set `debugMarkers: true` + `debugEntityTypes: ['0345', '0ED2']` in `chateauGuillard.ts`.
2. Launch Château Guillard; read `[entity]` console lines → record both 0345 world positions.
3. While there, read the `[HealthPackExtractor]` log for the **37C2 slot Y values** → resolve the ground-vs-upper-corridor contradiction; fix descriptor comments (A4 adjacency).
4. **Decision gate:**
   - 0345 positions at walkable ground (Y reachable by the `max(y+1, 1)` probe) and inside playable bounds → **adopt** as spawn points (labels `spawn-volume-1/2`), keep non-pack-colocated calibrated points for variety.
   - Elevated / out of bounds / only ×2 and too clustered → **fallback:** keep the 4-point layout but nudge the two 37C2-colocated points ~3 m along the corridor axis; verify walkable.
5. Revert debug flags to `false`.

### SP-1.4 Data + counter changes

- **Decoupling rule (authoring invariant, record as descriptor comment):** every player spawn point must be **>1.5 m XZ from every configured health-pack slot node** (pickup radius). Applies to the final point set regardless of which gate branch wins.
- `SpawnPoint.yaw?: number` — optional spawn facing (radians). Compile passes through (runtime tuple becomes `[x, z, yaw?]` or a small struct — prefer struct `{ x, z, yaw? }` over widening the tuple).
- Rename `spawnCount` → module-scope `packRotationCounter` — this **is** assessment fix A2 (module-scope counter; assessment called it `arenaSpawnCounter`, renamed here for honesty about what it drives). Leaves the "spawn" name space free for the SP-2 player cursor.

### SP-1 verification

- Build clean (`vue-tsc` + `vite build`).
- Live: packs still extract 6 slots / 3 active on rotation 0; rotation cycles 0→1→2 across Play Again (A2 proof); spawn points land on walkable floor; console shows no spawn point within 1.5 m of a pack slot (eyeball the logged coordinates).

### SP-1 files

| File | Change |
|---|---|
| `src/maps/entityScan.ts` | new — generic entity node scan |
| `src/items/HealthPackExtractor.ts` | refactor onto entityScan (API unchanged) |
| `src/maps/MapDescriptor.ts` | `debugEntityTypes?`, `SpawnPoint.yaw?`, runtime spawn struct, compile pass-through |
| `src/modules/DboxSceneModule.ts` | debugMarkers EMPTY extension; `packRotationCounter` (A2) |
| `src/maps/chateauGuillard.ts` | final spawn point set + decoupling-rule comment + 37C2 Y comment fix |

## 3. SP-2 — Instant respawn with rotation *(depends on B1 HealthManager; same session)*

### Design

- **Rotation:** module-scope `let playerSpawnCursor = -1` in `DboxSceneModule.ts`. Lazy-init to `Math.floor(Math.random() * n)` on first use; every placement does `cursor = (cursor + 1) % n`. Round-robin from a random start — survives remounts (same rationale as A2), guarantees no immediate repeat (n ≥ 2), and mount-spawn + death-respawn share the cursor. *Multi-map caveat: cursor is global across arenas; acceptable single-map, key by arena id when map #2 lands (same caveat as the A2 pack counter — note in code comment).*
- **`placeAtSpawn()`** (private, extracted from `onMount` lines 146–157):
  - Map mode: advance cursor → `spawnPoints[cursor]`; sandbox mode: fixed origin `(0, 0)` (calibration grid centre).
  - `sampleTerrainSurfaceY(x, z)` → `y = floorY + PLAYER_CAPSULE_HALF_HEIGHT` → `character.position.set` + `controller.syncPosition`.
  - Zero planar carry: `controller.setPlanarCarryVelocity(0, 0)` — otherwise live punch carry survives the teleport and launches the player from the new point. Vertical velocity self-zeroes via the controller's ground-snap path (spawn is at ground height); if live testing shows residual air-state, add `applyVerticalAbilityImpulse(0, { verticalBlend: 'replace' })`.
  - If the spawn point has `yaw` → `controller.resetFacing(yaw)`; else keep current facing.
- **`respawnPlayer()`** (private): `placeAtSpawn()` + `playerHealth.reset()` (B1 `HealthManager` gains `reset(): void` → hp = maxHp) + `roundStats.deaths++` + console.debug.
- **Death check:** in `onAfterGameplayTick`, after lab tick / pack `hpGain` application, before `roundManager.tick`: `if (playerHealth.hp <= 0) this.respawnPlayer()`. Unconditional on round state — countdown has no damage sources, post-`ended` respawn is harmless (stats frozen per B2).
- **Round interaction:** respawn never touches the round timer (deathmatch semantics). No spawn-protection window in V1 (OW has none).
- **Stats:** `RoundStats` (B2) gains `deaths`; results screen (B3) gains a Deaths row.

### Accepted V1 edges (named per pivot-point rule)

- Ability cooldowns persist through death (OW behaviour — intended, not a gap).
- Lab is not notified of respawn: a slam-hold or punch-charge held across death continues from the new position. Rare with fall-damage-only deaths (OD-1 triggers on landing, abilities mostly resolved); revisit with C2 target-system extraction.
- Camera jump-cuts to the new position (close-follow snap). That's the V1 experience by decision; death cam is Phase 5.

### SP-2 verification *(live, after B1 wires OD-1 fall damage)*

- Jump from mainhall upper floor → fatal landing → instant respawn at a *different* point, HP full, `deaths` incremented, round timer uninterrupted.
- Die twice more → spawn points cycle in order (no repeat), health packs unaffected by player deaths.
- Die while a pack sits on cooldown → cooldown continues (pack state independent of player spawn state).
- Pause (P) during the whole sequence → nothing desyncs (A1 must already be in).

### SP-2 files

| File | Change |
|---|---|
| `src/modules/DboxSceneModule.ts` | `playerSpawnCursor`, `placeAtSpawn()`, `respawnPlayer()`, death check in `onAfterGameplayTick` |
| `src/health/HealthManager.ts` | (B1 file) include `reset(): void` in its initial API |
| `src/round/` types | `RoundStats.deaths` (B2 amendment) |
| `src/views/DboxView.vue` | Deaths row on results screen (B3 amendment) |

## 4. Sequencing (updated plan of record)

```
A1–A4 + SP-1 (Tier A session)  →  B1+B2+SP-2 (session)  →  B3+B4 (session)  →  T-B18 closed
P1/P2 any time this week (independent)
C1–C4 by trigger
```

## 5. Deferred (named risks)

- **Death cam / kill feed** — Phase 5 polish (locked 2026-06-10).
- **Spawn-protection window** — none in V1; add only if playtests show spawn-camping by blobs/abilities.
- **Distance/danger-aware spawn choice** (OW-style "farthest from action") — refinement after multi-enemy or champion #2 work; round-robin is V1.
- **Per-map spawn cursor keying** — required when arena #2 ships; trivial (Map keyed by arena id).
- If the 0345 gate falls to the fallback branch, true OW spawn positions remain unknown — the nudged points are calibrated approximations, revisit only if spawn feel is off.
