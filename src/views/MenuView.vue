<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const arenas = [
  {
    id: 'chateau-guillard',
    label: 'Château Guillard',
    sub: 'OW1 map · Rapier physics',
    accent: 'bg-violet-900 hover:bg-violet-800 active:bg-violet-950 text-violet-100',
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    sub: 'Calibration arena',
    accent: 'bg-cyan-900 hover:bg-cyan-800 active:bg-cyan-950 text-cyan-100',
  },
]
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4 select-none">
    <div class="flex flex-col items-center gap-2 mb-8">
      <h1 class="text-4xl font-bold tracking-tight text-white">three-dbox</h1>
      <p class="text-xs font-medium tracking-[0.3em] uppercase text-zinc-500">combat sandbox</p>
    </div>

    <div class="flex flex-col gap-3 w-60">
      <!-- Arena buttons -->
      <p class="text-zinc-600 text-[10px] font-mono uppercase tracking-widest text-center mb-1">Select arena</p>
      <button
        v-for="a in arenas"
        :key="a.id"
        class="w-full px-6 py-3 rounded-xl transition-colors text-left"
        :class="a.accent"
        @click="router.push(a.id === 'sandbox' ? '/dbox' : `/dbox?arena=${a.id}`)"
      >
        <div class="text-sm font-semibold leading-none">{{ a.label }}</div>
        <div class="text-[10px] opacity-60 mt-0.5 font-mono">{{ a.sub }}</div>
      </button>

      <div class="border-t border-zinc-800 my-1" />

      <button
        class="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-400 text-sm font-semibold rounded-xl transition-colors"
        @click="router.push('/settings')"
      >
        Settings
      </button>
    </div>

    <p class="absolute bottom-6 text-zinc-600 text-xs font-mono">
      WASD to move · RMB punch · Q uppercut · E slam
    </p>
  </div>
</template>
