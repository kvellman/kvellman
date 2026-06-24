<script setup lang="ts">
// Audit log (M5-D, admin only). Read-only, filterable by action and package.
definePageMeta({
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value?.role !== 'admin') return navigateTo('/')
    },
  ],
})
useHead({ title: () => t('Audit log') })

interface AuditEntry {
  id: number
  createdAt: string
  action: string
  actor: string | null
  packageIdentifier: string | null
  packageVersion: string | null
  detail: Record<string, unknown> | null
}

const { t } = useI18n()
// `action` is null for "all" (Reka Select forbids an empty-string item value).
const action = ref<string | null>(null) // exact, from the dropdown
const actionq = ref('') // substring, from free-text
const actor = ref('') // substring
const q = ref('') // package identifier substring
const from = ref('') // YYYY-MM-DD
const to = ref('') // YYYY-MM-DD
const { data, refresh, status } = await useFetch<{ count: number; entries: AuditEntry[]; actions: string[] }>(
  '/api/audit',
  { query: { action, actionq, actor, q, from, to } },
)

// Dropdown options: "All actions" (null) + every action seen in the log.
const actionItems = computed(() => [
  { label: t('All actions'), value: null },
  ...(data.value?.actions ?? []).map((a) => ({ label: a, value: a })),
])

let timer: ReturnType<typeof setTimeout> | undefined
watch([action, actionq, actor, q, from, to], () => {
  clearTimeout(timer)
  timer = setTimeout(() => refresh(), 250)
})

function fmtTime(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 19).replace('T', ' ') : '—'
}
function detailText(d: Record<string, unknown> | null): string {
  if (!d || Object.keys(d).length === 0) return ''
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ')
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('Audit log') }}</h1>
      <p class="text-muted">{{ $t('Every mutating action, newest first.') }}</p>
    </header>

    <div class="space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="$t('Action')">
          <USelect v-model="action" :items="actionItems" icon="i-lucide-filter" class="w-56" />
        </UFormField>
        <UFormField :label="$t('Search action')">
          <UInput v-model="actionq" :placeholder="$t('e.g. crea, delete, sync')" icon="i-lucide-search" class="w-44" />
        </UFormField>
        <UFormField :label="$t('Actor')">
          <UInput v-model="actor" :placeholder="$t('Filter by actor…')" icon="i-lucide-user" class="w-44" />
        </UFormField>
        <UFormField :label="$t('Package')">
          <UInput v-model="q" :placeholder="$t('Filter by identifier…')" icon="i-lucide-search" class="w-44" />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="$t('From')">
          <UInput v-model="from" type="date" class="w-40" />
        </UFormField>
        <UFormField :label="$t('To')">
          <UInput v-model="to" type="date" class="w-40" />
        </UFormField>
      </div>
    </div>

    <UCard>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-default text-muted">
            <th class="py-2 pr-4 font-medium whitespace-nowrap">{{ $t('Time') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Action') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Actor') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Package') }}</th>
            <th class="py-2 font-medium">{{ $t('Detail') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in data?.entries" :key="e.id" class="border-b border-default/50 last:border-0 align-top">
            <td class="py-2 pr-4 text-xs text-muted whitespace-nowrap">{{ fmtTime(e.createdAt) }}</td>
            <td class="py-2 pr-4"><UBadge color="neutral" variant="subtle" size="sm">{{ e.action }}</UBadge></td>
            <td class="py-2 pr-4">{{ e.actor || '—' }}</td>
            <td class="py-2 pr-4 font-mono break-all">
              {{ e.packageIdentifier ?? '—' }}<span v-if="e.packageVersion" class="text-muted"> · {{ e.packageVersion }}</span>
            </td>
            <td class="py-2 text-muted break-all">{{ detailText(e.detail) }}</td>
          </tr>
          <tr v-if="status !== 'pending' && !data?.entries.length">
            <td colspan="5" class="py-6 text-center text-muted">{{ $t('No matching entries.') }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
