<script setup lang="ts">
// Collapsible change history for a package or a single version (M5). Reads the package-scoped audit
// view; collapsed by default. When packageVersion is set it shows only that version's entries.
const props = defineProps<{ packageIdentifier: string; packageVersion?: string }>()

interface HistoryEntry {
  id: number
  createdAt: string
  action: string
  actor: string | null
  packageVersion: string | null
  detail: Record<string, unknown> | null
}

const { data } = await useFetch<{ count: number; entries: HistoryEntry[] }>(
  () => `/api/packages/${props.packageIdentifier}/history`,
  { query: { version: props.packageVersion } },
)

const open = ref(false)
function fmtTime(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 16).replace('T', ' ') : '—'
}
function detailText(d: Record<string, unknown> | null): string {
  if (!d || Object.keys(d).length === 0) return ''
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ')
}
</script>

<template>
  <UCard v-if="data && data.count">
    <template #header>
      <button type="button" class="flex w-full items-center justify-between" @click="open = !open">
        <span class="flex items-center gap-2 font-semibold">
          {{ $t('History') }}
          <UBadge color="neutral" variant="subtle" size="sm">{{ data.count }}</UBadge>
        </span>
        <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-muted" />
      </button>
    </template>

    <table v-if="open" class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-default text-muted">
          <th class="py-2 pr-4 font-medium whitespace-nowrap">{{ $t('Time') }}</th>
          <th class="py-2 pr-4 font-medium">{{ $t('Action') }}</th>
          <th class="py-2 pr-4 font-medium">{{ $t('Actor') }}</th>
          <th v-if="!packageVersion" class="py-2 pr-4 font-medium">{{ $t('Version') }}</th>
          <th class="py-2 font-medium">{{ $t('Detail') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in data.entries" :key="e.id" class="border-b border-default/50 last:border-0 align-top">
          <td class="py-2 pr-4 text-xs text-muted whitespace-nowrap">{{ fmtTime(e.createdAt) }}</td>
          <td class="py-2 pr-4"><UBadge color="neutral" variant="subtle" size="sm">{{ e.action }}</UBadge></td>
          <td class="py-2 pr-4">{{ e.actor || '—' }}</td>
          <td v-if="!packageVersion" class="py-2 pr-4 font-mono">{{ e.packageVersion ?? '—' }}</td>
          <td class="py-2 text-muted break-all">{{ detailText(e.detail) }}</td>
        </tr>
      </tbody>
    </table>
  </UCard>
</template>
