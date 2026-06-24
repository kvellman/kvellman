<script setup lang="ts">
import type { ComputedRef } from 'vue'

// Renders a manifest value, highlighting the overlay change inline when the field differs from
// upstream: common prefix/suffix stay plain, the removed upstream segment is struck-through, the
// added overlay segment is highlighted. Falls back to the plain value for unchanged fields.
// Reads the overlay diff via inject (provided by the version detail page).
const props = defineProps<{ path: string; value?: string | null }>()

type Change = { upstream: string; overlay: string }
const diffMap = inject<ComputedRef<Map<string, Change>>>('overlayDiffMap')

const parts = computed(() => {
  const e = diffMap?.value.get(props.path)
  if (!e) return null
  const a = e.upstream ?? ''
  const b = e.overlay ?? ''
  const min = Math.min(a.length, b.length)
  let p = 0
  while (p < min && a[p] === b[p]) p++
  let s = 0
  while (s < min - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return {
    prefix: b.slice(0, p),
    removed: a.slice(p, a.length - s),
    added: b.slice(p, b.length - s),
    suffix: b.slice(b.length - s),
  }
})
</script>

<template>
  <span v-if="parts">
    <span>{{ parts.prefix }}</span
    ><del v-if="parts.removed" class="text-error line-through opacity-70">{{ parts.removed }}</del
    ><ins v-if="parts.added" class="rounded bg-warning/30 px-1 font-medium no-underline">{{ parts.added }}</ins
    ><span>{{ parts.suffix }}</span>
  </span>
  <span v-else>{{ value ?? '—' }}</span>
</template>
