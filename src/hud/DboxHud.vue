<script setup lang="ts">
import { computed } from 'vue'
import type { HudSnapshot, AbilityHudEntry } from './types'

const props = defineProps<{ snapshot: HudSnapshot }>()

const healthPct = computed(() =>
  props.snapshot.healthMax > 0
    ? (props.snapshot.health / props.snapshot.healthMax) * 100
    : 0,
)

const basicAttack = computed(() =>
  props.snapshot.abilities.find(a => a.id === 'hand-cannon'),
)

const cooldownAbilities = computed(() =>
  props.snapshot.abilities.filter(a => a.id !== 'hand-cannon'),
)

function cdDisplay(a: AbilityHudEntry): string {
  if (a.cooldownLeft <= 0) return ''
  return a.cooldownLeft.toFixed(1)
}

function cdPct(a: AbilityHudEntry): number {
  if (a.cooldownMax <= 0 || a.cooldownLeft <= 0) return 0
  return (a.cooldownLeft / a.cooldownMax) * 100
}
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-20 pointer-events-none select-none">
    <div class="flex items-end justify-center gap-8 px-6 pb-4">

      <!-- ═══ LEFT: Portrait + Health ═══ -->
      <div class="flex items-end gap-3">
        <!-- Character icon -->
        <div class="relative w-14 h-14 rounded-md bg-gray-900/80 border border-white/15 flex items-center justify-center overflow-hidden">
          <span class="text-2xl font-black text-white/70 leading-none">D</span>
        </div>

        <!-- Health bar stack -->
        <div class="flex flex-col gap-0.5 min-w-[10rem]">
          <!-- Numbers -->
          <div class="flex items-baseline gap-1.5 px-0.5">
            <span class="text-lg font-bold tabular-nums text-white/90 leading-none">
              {{ snapshot.health }}
            </span>
            <span class="text-xs font-semibold tabular-nums text-white/35 leading-none">
              {{ snapshot.healthMax }}
            </span>
          </div>

          <!-- Health bar -->
          <div class="relative h-3.5 rounded-sm bg-gray-900/70 border border-white/10 overflow-hidden">
            <div
              class="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-100"
              :class="healthPct > 25 ? 'bg-emerald-500/90' : 'bg-red-500/90'"
              :style="{ width: healthPct + '%' }"
            />
            <!-- Segment markers -->
            <div class="absolute inset-0 flex">
              <div v-for="i in 4" :key="i" class="flex-1 border-r border-black/30 last:border-r-0" />
            </div>
          </div>

          <!-- Shield bar (only visible when shields > 0) -->
          <div
            v-if="snapshot.shields > 0"
            class="relative h-2 rounded-sm bg-gray-900/50 border border-cyan-500/20 overflow-hidden"
          >
            <div
              class="absolute inset-y-0 left-0 rounded-sm bg-cyan-400/70"
              :style="{ width: (snapshot.shieldsMax > 0 ? (snapshot.shields / snapshot.shieldsMax) * 100 : 0) + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- ═══ RIGHT: Abilities ═══ -->
      <div class="flex items-end gap-2">

        <!-- Basic attack (LMB) -->
        <div v-if="basicAttack" class="flex flex-col items-center gap-1">
          <div
            class="relative w-11 h-11 rounded-md border flex items-center justify-center"
            :class="basicAttack.isActive
              ? 'bg-white/15 border-white/40'
              : 'bg-gray-900/70 border-white/15'"
          >
            <!-- Placeholder fist icon -->
            <svg class="w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <span class="text-[9px] font-mono font-semibold text-white/40 uppercase tracking-wider">
            {{ basicAttack.key }}
          </span>
        </div>

        <!-- Separator -->
        <div class="w-px h-10 bg-white/10 mx-1" />

        <!-- Cooldown abilities -->
        <div
          v-for="ability in cooldownAbilities"
          :key="ability.id"
          class="flex flex-col items-center gap-1"
        >
          <div
            class="relative w-11 h-11 rounded-md border flex items-center justify-center overflow-hidden"
            :class="ability.cooldownLeft > 0
              ? 'bg-gray-900/80 border-white/10'
              : ability.isActive
                ? 'bg-amber-500/20 border-amber-400/50'
                : 'bg-gray-900/70 border-emerald-400/30'"
          >
            <!-- Cooldown sweep overlay -->
            <div
              v-if="ability.cooldownLeft > 0"
              class="absolute inset-0 bg-black/60"
              :style="{ clipPath: `inset(${100 - cdPct(ability)}% 0 0 0)` }"
            />

            <!-- Cooldown number -->
            <span
              v-if="ability.cooldownLeft > 0"
              class="relative text-sm font-bold tabular-nums text-white/80"
            >
              {{ cdDisplay(ability) }}
            </span>

            <!-- Ready indicator -->
            <div
              v-else
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
              :class="ability.isActive ? 'border-amber-400 bg-amber-400/20' : 'border-emerald-400/60 bg-emerald-400/10'"
            >
              <div class="w-1.5 h-1.5 rounded-full" :class="ability.isActive ? 'bg-amber-400' : 'bg-emerald-400/80'" />
            </div>
          </div>

          <!-- Key label -->
          <span class="text-[9px] font-mono font-semibold text-white/40 uppercase tracking-wider">
            {{ ability.key }}
          </span>
        </div>
      </div>

    </div>
  </div>
</template>
