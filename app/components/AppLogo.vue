<script setup lang="ts">
// kvellman brand mark: a solid navy "K" with a teal "fluid network" running through it — a source
// node at the upper-left of the stem, flowing down the stem and bundling along both diagonal arms
// (one source distributing through the letter). Flat/2D, no gradients/shadows. The navy stroke uses
// currentColor so the mark stays legible in dark mode (the wordmark already follows the text color).
// Set :wordmark="false" for the icon only.
withDefaults(defineProps<{ size?: number; wordmark?: boolean }>(), { size: 28, wordmark: true })
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-[#1f3b5e] dark:text-white">
    <svg :width="size" :height="size" viewBox="0 0 64 64" class="shrink-0" aria-hidden="true">
      <g stroke="currentColor" stroke-width="11" fill="none" stroke-linecap="butt" stroke-linejoin="miter">
        <path d="M19 8V56" />
        <path d="M19 32L45 12" />
        <path d="M19 32L45 52" />
      </g>
      <g stroke="#22b8a6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.8">
        <path d="M16 19V53" />
        <path d="M42 14L21 30L21 52" />
        <path d="M45.5 15L23 32L44 51" />
        <path d="M21 39L40 53" />
      </g>
      <circle cx="16" cy="16" r="3.2" fill="#22b8a6" />
    </svg>
    <span v-if="wordmark" class="font-bold tracking-tight">kvellman</span>
  </span>
</template>
