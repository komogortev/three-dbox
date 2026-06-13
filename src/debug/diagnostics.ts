import type { TerrainSurfaceSampler } from '@base/player-three'

/**
 * EX-1 diagnostics (experience-floor sprint).
 *
 * Self-contained, flag-gated instrumentation for the perf + navigation diagnosis
 * session.  Nothing here runs unless a `?perf` / `?navdebug` query flag is present,
 * so the production path is untouched.  Safe to delete wholesale once EX-2/EX-3 land
 * and the findings are banked — it owns no game state.
 */

/** True when `?<name>` is present and not explicitly disabled (`=0` / `=false`). */
export function hasQueryFlag(name: string): boolean {
  if (typeof window === 'undefined') return false
  const v = new URLSearchParams(window.location.search).get(name)
  if (v === null) return false
  return v !== '0' && v !== 'false'
}

/** Numeric query param (`?pixelratio=1`) or null when absent / non-numeric. */
export function queryNumber(name: string): number | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get(name)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Decorates a {@link TerrainSurfaceSampler} to count `sample()` calls between reads.
 * Used to answer "how many terrain raycasts per frame" without touching the hot path
 * in production (only wrapped when `?perf` is on).
 */
export class CountingSampler implements TerrainSurfaceSampler {
  private count = 0
  constructor(private readonly inner: TerrainSurfaceSampler) {}
  sample(x: number, z: number): number {
    this.count++
    return this.inner.sample(x, z)
  }
  /** Returns calls since the last read and resets the counter. */
  takeCount(): number {
    const c = this.count
    this.count = 0
    return c
  }
}

/**
 * Minimal on-screen perf panel so the owner can A/B on their actual display
 * (`?perf=1` to show, `?pixelratio=N` to compare capped vs uncapped). Monospace,
 * click-through, top-left of the engine container.
 */
export class PerfOverlay {
  private readonly el: HTMLDivElement
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div')
    this.el.style.cssText =
      'position:absolute;top:8px;left:8px;z-index:9999;' +
      'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#5dff8f;' +
      'background:rgba(0,0,0,.62);padding:6px 9px;border-radius:5px;' +
      'white-space:pre;pointer-events:none;text-shadow:0 1px 2px #000;'
    parent.appendChild(this.el)
  }
  set(text: string): void {
    this.el.textContent = text
  }
  dispose(): void {
    this.el.remove()
  }
}
