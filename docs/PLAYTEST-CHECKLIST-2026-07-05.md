# Owner Playtest Checklist — consolidated (created 2026-07-05)

> **Purpose:** one sitting that clears every pending owner-verify gate. Sections A–D are valid on the current build; section E activates once S1 lands the `?kcc` flag. If S1 is close, prefer running the whole thing after S1 so the A/B comparison is included.
>
> **Setup:** `pnpm dev` → menu → Château Guillard, then add `?navdebug` to the URL (append `&perf` for the frame overlay). **"Play Again" preserves the query flags; going back through the menu cards drops them.** Keep the console open — error-level lines are worth a screenshot.

## A. Floor-tile stumble (fix committed `3751992`, 2026-06-15)

Walk the main-hall floor in all directions for ~60 s, crossing tile seams at walking pace and at a run.

- **PASS:** no micro-hitches, no vertical stutters, no sideways nudges on flat floor.
- **FAIL:** note where (main hall / corridor / courtyard) and whether it feels vertical (lift) or lateral (push).

## B. Remount grounding ("spawn under textures", fix committed `3751992`)

Let a round end (or quit to end screen) → **Play Again ×5**.

- **PASS:** every respawn starts feet-on-floor — no spawn under/inside geometry, no float-then-snap on the first step.
- Console shows a `SPAWN` trace each remount; `gap` should read ≈ 0.

## C. Anti-tunnelling (EX-2.1, shipped 2026-06-14)

Full-charge Rocket Punch (hold RMB to max charge) point-blank into thin walls — at least 3 different walls, including interior corridor walls and an exterior wall.

- **PASS:** the punch always stops or slides at the wall; you never end up outside the map or inside geometry.
- **FAIL:** note the exact wall and whether it happens at max charge only.

## D. Stairs baseline (known issue — this is a RECORDING run, not a gate)

Walk up **and** down the main staircases, slow and fast, including stopping mid-flight.

- **EXPECTED on the current build:** occasional vertical pops, especially near landings/overhangs. This is the two-Y-writer defect the KCC rework (S1) replaces.
- Record where it's worst — this becomes the before/after comparison for section E.

## E. KCC A/B (only after S1 lands the `?kcc` flag)

Repeat A–D twice: once with `?kcc=1&navdebug`, once with `?kcc=0&navdebug` (old path).

- **PASS for S1 sign-off (`?kcc=1`):** flat walk with no stumble; stairs **up and down** smooth; full-charge punch stops at every wall; spawn grounded on every Play-Again.
- Any glitch with `?kcc=1`: note it + whether `?kcc=0` shows the same — one query param distinguishes a KCC tuning issue from a pre-existing one.

## Report format

Per section: PASS / FAIL + one line on where and what it felt like. Console screenshots for any red lines. Deliver as a message or drop notes into this file — next session folds results into `SPRINT-EX-V1.md`.
