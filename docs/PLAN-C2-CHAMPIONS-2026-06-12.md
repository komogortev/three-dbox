# three-dbox — Multi-Champion Plan: C2-First Session (2026-06-12)

> Scope: **C2** target-system extraction + champion registry, pulled forward ahead of B1 by explicit direction call (2026-06-12): multi-champion is near-term intent, and B1 as specced writes blob HP + damage into exactly the code C2 extracts.
> Companion to `ASSESSMENT-2026-06-10.md` (C2 was Tier-C triggered debt; trigger "Champion #2" declared fired) and `PLAN-SPAWN-2026-06-10.md` (B1/SP-2 unchanged, land after this).
> Readiness basis (2026-06-12 session, direct read): multi-MAP management already exists (ARENA_REGISTRY + MapDescriptorData/compileMapDescriptor + entityScan; 2-file onboarding) — **no map-side system work**. Multi-CHAMPION blocked by champion-identity scatter + F7.

## 1. Current couplings (code-verified)

| # | Coupling | Evidence |
|---|----------|----------|
| 1 | Blob/target system lives inside `DoomfistLab` (~150 of 604 lines): `BlobNpc`, `BLOB_*` constants, `spawnPoolBlobs`, `tickBlobNpcs` (gravity/ground/wall-bounce/lock), wall fields | `DboxLab.ts:20-45,69-71,126-130,438-525` |
| 2 | `setWallGeometry` sits on the `IAbilityLab` contract only to serve blobs | `IAbilityLab.ts:17` |
| 3 | Lab class hardcoded: `new DoomfistLab(this, champion)` | `DboxSceneModule.ts:74` |
| 4 | Champion mesh/anim binding lives in the scene descriptor, not the champion: `dfist_base.glb`, `modelFitHeight 2.1`, clip indices, footprint, prune flag | `scenes/dbox.ts:15,27-38` |
| 5 | Blob gravity is a champion param (`risingUppercut.npcGravity`) used as general target gravity | `DboxLab.ts:462` |
| 6 | Blob unmount removes meshes but never disposes geometry/materials (bounded by engine teardown — F8 family) | `DboxLab.ts:142-143` |

Already champion-generic (no work needed): `IAbilityLab` as a held interface, `HudSnapshot`/`AbilityHudEntry` (N-ability array), `ChampionConfig` injection point on `DboxSceneModuleOptions`, HUD key labels sourced from config (A4).

## 2. Eventual direction (target architecture)

- **Champion = registry entry**, mirroring `ArenaEntry`: `{ id, label, config, character, createLab }`. Adding champion #2 = one entry + one lab class + one GLB; no orchestrator edits.
- **Targets/NPCs = arena infrastructure** (`TargetSystem` owned by `DboxSceneModule`); champions *query and shove* targets via the host, never own them. Unlocks map-mode NPC enemies (C2's other trigger) and lets B1 put HP/KO state in its final home.
- **Champion binding = who** (mesh, scale, clips); **scene/map = where** (start position, arena). Recorded as the split rule.
- Later, each on its own trigger: champion select UI (MenuView row + `?champion=` query), per-champion input binding defaults, map-mode target spawn sets in `MapDescriptorData`, per-champion HUD portrait.

## 3. C2 session scope

### CH-1 — `TargetSystem` extraction *(the meat; no behavior change)*

New `src/targets/TargetSystem.ts`:

- **State**: `TargetBlob { mesh, vx, vy, vz, lockRemaining }` (B1 adds `hp` here), `BLOB_*` constants move in (`UPPERCUT_LOCK_EMISSIVE` → `LOCKED_EMISSIVE`).
- **Lifecycle**: `mount(scene, spawnSet)` (sandbox pool = current `BLOB_SPAWN_XZ`; map mode = empty set — preserves `spawnBlobs: !mapLoaded` semantics, decision moves to the module), `unmount()` (**with** geometry+material disposal — closes coupling #6), `tick(simDelta)` = current `tickBlobNpcs` verbatim, `setWallGeometry(planes, boxes)`.
- **Construction**: takes the `GameplayLabHost` (terrain sampling + carry decay — same surface the lab uses today) + `gravity` param. Module passes `champion.config.risingUppercut.npcGravity` for exact parity; code comment marks gravity for relocation to target-system config in a later tuning pass (coupling #5 named, not solved).
- **Mutator API** (minimal generic set covering both abilities):
  - `lock(t, seconds)`
  - `setPlanarVelocity(t, vx, vz)` / `addPlanarVelocity(t, dvx, dvz)`
  - `raiseVerticalTo(t, vy)` (max-blend — uppercut) / `capVerticalAt(t, vy)` (min-blend — slam)
  - `getTargets(): readonly TargetBlob[]` — cone/radius hit *detection* stays in the lab (it's ability-shaped); *application* goes through mutators.

Interface changes (one batch, both sides together per CLAUDE.md rule):
- `IAbilityLab`: **remove** `setWallGeometry`; `mount` loses the `spawnBlobs` opt.
- `GameplayLabHost`: **add** `getTargetSystem(): TargetSystem`.
- `DboxSceneModule`: owns `targetSystem`; `onMount` wires walls + spawn set; `onAfterGameplayTick` order = `lab.afterGameplayTick` → `targetSystem.tick(simDelta)` (preserves current within-frame order: ability impulses land before target integration).
- `DoomfistLab` after: `applyUppercutToNearbyBlobs` / `applySlamToBlobsInCone` iterate `host.getTargetSystem().getTargets()` + mutators; blob fields/spawn/tick/wall fields deleted (~-150 lines).

### CH-2 — Champion registry

New `src/champions/registry.ts`:

```ts
export interface CharacterBinding {
  modelUrl: string
  modelFitHeight: number
  rotationY?: number
  terrainFootprintRadius?: number
  pruneExtraSkinnedMeshes?: boolean
  animationClipUrls: string[]
  locomotionClipIndices: Record<string, number>
}
export interface ChampionEntry {
  id: string            // 'doomfist'
  label: string
  config: ChampionConfig
  character: CharacterBinding
  createLab(host: GameplayLabHost, cfg: ChampionConfig): IAbilityLab
}
export const CHAMPION_REGISTRY: ChampionEntry[] = [DOOMFIST_ENTRY]
```

- `DOOMFIST_ENTRY.character` absorbs the binding from `scenes/dbox.ts` (GLB url + draco-not-meshopt comment, fitHeight 2.1, clip indices 4/6/3, footprint 0.22, prune flag); the descriptor keeps only scene-shaped data (start position, pool label).
- `DboxSceneModuleOptions.champion?: ChampionConfig` → `ChampionEntry` (no current caller passes it — registry options omit it; default `DOOMFIST_ENTRY`).
- Constructor: `structuredClone` the incoming descriptor, stamp `descriptor.character` from `entry.character` (descriptor singletons in `arenas/registry.ts` must not be mutated cross-mount; `dboxScene` is already proven structuredClone-safe), `this.lab = entry.createLab(this, entry.config)`.
- `rocketPunchPointer` stays lab-internal (champion-specific input is the lab's business). Global Q/E bindings unchanged — per-champion binding defaults are a champion-#2-trigger follow-up.

### CH-3 — Riders (small, same files)

- **Per-arena counter keying** (the only maps-axis work from the readiness assessment): `packRotationCounter` → `Map<string, number>` keyed by `map.glbUrl ?? 'sandbox'`; same key scheme reserved for SP-2's `playerSpawnCursor`.
- Stale-comment fixes encountered in touched files (A4 spirit).

### Out of scope (recorded)

Champion select UI · per-champion bindings · map-mode target spawn points · hand cannon (T-B8) · blob HP/KO (B1) · blob AI of any kind.

## 4. Parity verification (refactor — behavior must not change)

- Build clean (`vue-tsc` + `vite build`).
- Live sandbox: 5 blobs at pool coords; uppercut launches + lock-emissive flares ~0.6 s; slam cone shoves with vy cap; blobs bounce off analytic walls (0.6 restitution feel) and settle on ground; pause (P) freezes blob motion (sim-delta tick); ×0.5 slow-mo slows it.
- Live Château: zero blobs (unchanged), packs extract 6 slots, rotation cycles, HUD identical.
- CodeReview subagent on the diff before commit (workspace rule; verbatim-quote guardrails).

## 5. B1 alignment (what this buys)

- `TargetBlob.hp` + `TargetSystem.damage(t, n)` + KO path land in their final home; `DoomfistLab` only reports hits.
- `GameplayLabHost` grows once more in B1 (`recordDamage`/`recordKo`/`isRoundPlaying`) against the already-extracted shape — no second migration.
- `HealthManager`, `RoundStats`, SP-2 specs unchanged. **OD-1..OD-3 still require resolution before B1** (unchanged from assessment §4).

## 6. Sequencing (plan of record, updated)

```
[pre-step: merge PR #5 → main, then PR #6 → main (assessment P1); branch feat/c2-champion-registry]
C2 (this plan)  →  B1+B2+SP-2  →  B3+B4  →  T-B18 closed
C1/C3/C4 remain triggered; map #2 = content decision, no system gate
```

> **Same-day amendment (2026-06-12 playtest feedback):** the EX experience-floor track (`GAP-V1-PUBLISH-2026-06-12.md` §2b — perf, navigation reliability, lighting, audio) is recommended to run **before** C2; C1 and C3 triggers are now fired and land in EX-2/EX-1 respectively. C2's content is unchanged — only its start slot moves.

Net cost: T-B18 lands one session later than the 2026-06-10 plan. Net gain: champion #2 = config + lab + GLB; no blob-HP rework; map-mode enemies unblocked.
