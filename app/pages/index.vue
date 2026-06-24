<script setup lang="ts">
// Admin dashboard: repository state (packages/versions/installers/catalog + audit activity) plus
// repository-usage telemetry (observed winget request signals, rolled up in telemetry_daily).
const { t } = useI18n()
useHead({ title: () => t('Dashboard') })
const { data: stats } = await useFetch('/api/stats')
const { data: usage } = await useFetch('/api/telemetry')
const { data: updates } = await useFetch('/api/updates')
const { data: approvals } = await useFetch('/api/approvals/pending')
const { canWrite, isAdmin } = useAuthz()

// Edge-node health (admin only; /api/nodes is admin-gated).
interface NodeRow {
  id: number
  name: string
  status: string
  lastSeenAt: string | null
  lastInfo: { version?: string; indexedPackages?: number; lastSyncAt?: string | null } | null
}
const { data: nodes } = await useFetch<NodeRow[]>('/api/nodes', { immediate: isAdmin.value, default: () => [] })
// A node counts as online if it heartbeated recently (3× the 60s default interval).
function nodeOnline(n: NodeRow): boolean {
  return !!n.lastSeenAt && Date.now() - new Date(n.lastSeenAt).getTime() < 180_000
}
const nodesOnline = computed(() => (nodes.value ?? []).filter(nodeOnline).length)

const origins = ['upstream', 'overlay', 'local'] as const
function originCount(o: string): number {
  return stats.value?.versions.byOrigin?.[o] ?? 0
}
function fmtTime(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 16).replace('T', ' ') : '—'
}

// Usage state: off / enabled-but-empty / has-data.
const usageTotal = computed(() => {
  const t = usage.value?.totals
  return t ? t.searches + t.fetches + t.downloads : 0
})
function pct(n: number, list: { count: number }[]): number {
  const max = Math.max(1, ...list.map((x) => x.count))
  return (n / max) * 100
}
</script>

<template>
  <div class="mx-auto max-w-6xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('Dashboard') }}</h1>
      <p class="text-muted">{{ $t('Overview of your repository.') }}</p>
    </header>

    <div v-if="stats" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ stats.packages }}</p><p class="text-sm text-muted">{{ $t('Packages') }}</p></div></UCard>
      <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ stats.versions.total }}</p><p class="text-sm text-muted">{{ $t('Versions') }}</p></div></UCard>
      <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ stats.installers.total }}</p><p class="text-sm text-muted">{{ $t('Installers') }}</p></div></UCard>
      <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ stats.catalog.count }}</p><p class="text-sm text-muted">{{ $t('Catalog packages') }}</p></div></UCard>
    </div>

    <UCard v-if="updates">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ $t('Updates available') }}</h2>
          <UBadge :color="updates.count ? 'warning' : 'neutral'" variant="subtle">{{ updates.count }}</UBadge>
        </div>
      </template>
      <div v-if="updates.count" class="divide-y divide-default/50">
        <div
          v-for="u in updates.updates"
          :key="u.packageIdentifier"
          class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
        >
          <div class="min-w-0">
            <ULink :to="`/packages/${u.packageIdentifier}`" class="font-medium text-primary hover:underline">{{ u.packageName }}</ULink>
            <span class="ml-2 font-mono text-xs text-muted break-all">{{ u.packageIdentifier }}</span>
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="font-mono text-muted">{{ u.currentVersion }}</span>
            <UIcon name="i-lucide-arrow-right" class="text-muted size-4" />
            <span class="font-mono">{{ u.latestVersion }}</span>
            <UButton
              v-if="canWrite"
              :to="`/packages/import?id=${encodeURIComponent(u.packageIdentifier)}`"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-download"
            >
              {{ $t('Import') }}
            </UButton>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-muted">{{ $t('All packages are up to date.') }}</p>
    </UCard>

    <UCard v-if="approvals && approvals.count">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ $t('Pending approvals') }}</h2>
          <UBadge color="warning" variant="subtle">{{ approvals.count }}</UBadge>
        </div>
      </template>
      <div class="divide-y divide-default/50">
        <div
          v-for="a in approvals.pending"
          :key="`${a.packageIdentifier}@${a.packageVersion}`"
          class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
        >
          <div class="min-w-0">
            <ULink :to="`/packages/${a.packageIdentifier}`" class="font-medium text-primary hover:underline">{{ a.packageName }}</ULink>
            <span class="ml-2 font-mono text-xs text-muted break-all">{{ a.packageIdentifier }}</span>
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <span class="font-mono text-muted">{{ a.packageVersion }}</span>
            <UBadge :color="originMeta(a.origin).color" variant="subtle" size="sm">{{ $t(originMeta(a.origin).label) }}</UBadge>
            <UButton
              :to="`/packages/${a.packageIdentifier}/${encodeURIComponent(a.packageVersion)}`"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-clipboard-check"
            >
              {{ $t('Review') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UCard v-if="isAdmin && nodes && nodes.length">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ $t('Edge nodes') }}</h2>
          <UBadge :color="nodesOnline ? 'success' : 'neutral'" variant="subtle">
            {{ $t('{online} of {total} online', { online: nodesOnline, total: nodes.length }) }}
          </UBadge>
        </div>
      </template>
      <table class="w-full text-sm">
        <tbody>
          <tr v-for="n in nodes" :key="n.id" class="border-b border-default/50 last:border-0">
            <td class="py-2 pr-3">
              <span class="inline-flex items-center gap-2">
                <span class="size-2 rounded-full" :class="nodeOnline(n) ? 'bg-success' : 'bg-muted'" />
                <span class="font-medium">{{ n.name }}</span>
              </span>
            </td>
            <td class="py-2 pr-3 text-muted">{{ n.lastInfo?.version ? `v${n.lastInfo.version}` : '—' }}</td>
            <td class="py-2 pr-3 text-muted">{{ $t('{n} pkgs', { n: n.lastInfo?.indexedPackages ?? 0 }) }}</td>
            <td class="py-2 text-right text-xs text-muted whitespace-nowrap">
              {{ nodeOnline(n) ? $t('online') : $t('last seen {time}', { time: fmtTime(n.lastSeenAt) }) }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <div v-if="stats" class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><h2 class="font-semibold">{{ $t('Versions by origin') }}</h2></template>
        <div class="space-y-3">
          <div v-for="o in origins" :key="o" class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <UBadge :color="originMeta(o).color" variant="subtle" size="sm">{{ $t(originMeta(o).label) }}</UBadge>
              <span class="text-muted">{{ originCount(o) }}</span>
            </div>
            <div class="h-2 rounded bg-elevated">
              <div
                class="h-2 rounded bg-primary/60"
                :style="{ width: `${stats.versions.total ? (originCount(o) / stats.versions.total) * 100 : 0}%` }"
              />
            </div>
          </div>
          <p class="pt-1 text-sm text-muted">
            {{ $t('{hosted} of {total} installers hosted locally', { hosted: stats.installers.hosted, total: stats.installers.total }) }}
          </p>
          <p class="text-sm text-muted">
            {{ $t('Catalog last synced: {time}', { time: fmtTime(stats.catalog.syncedAt) }) }}
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ $t('Recent activity') }}</h2>
            <ULink v-if="isAdmin" to="/audit" class="text-xs text-primary hover:underline">{{ $t('View all') }}</ULink>
          </div>
        </template>
        <table v-if="stats.recent.length" class="w-full text-sm">
          <tbody>
            <tr v-for="(a, i) in stats.recent" :key="i" class="border-b border-default/50 last:border-0 align-top">
              <td class="py-2 pr-3"><UBadge color="neutral" variant="subtle" size="sm">{{ a.action }}</UBadge></td>
              <td class="py-2 pr-3 font-mono break-all">
                {{ a.packageIdentifier ?? '—' }}<span v-if="a.packageVersion" class="text-muted"> · {{ a.packageVersion }}</span>
                <span v-if="a.actor" class="ml-1 text-muted">· {{ a.actor }}</span>
              </td>
              <td class="py-2 text-right text-xs text-muted whitespace-nowrap">{{ fmtTime(a.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-muted">{{ $t('No activity yet.') }}</p>
      </UCard>
    </div>

    <!-- Repository usage (telemetry) -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold">{{ $t('Usage') }}</h2>
        <UBadge color="neutral" variant="subtle" size="sm">{{ $t('Observed winget requests') }}</UBadge>
      </div>

      <UAlert
        v-if="usage && !usage.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-power"
        :description="$t('Telemetry is off — set TELEMETRY_ENABLED=true to record repository usage.')"
      />
      <UAlert
        v-else-if="usage && usageTotal === 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-line-chart"
        :description="$t('No usage recorded yet — events appear once winget clients query this source.')"
      />

      <template v-else-if="usage">
        <div class="grid gap-4 sm:grid-cols-3">
          <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ usage.totals.searches }}</p><p class="text-sm text-muted">{{ $t('Searches') }}</p></div></UCard>
          <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ usage.totals.fetches }}</p><p class="text-sm text-muted">{{ $t('Manifest fetches') }}</p></div></UCard>
          <UCard><div class="space-y-1"><p class="text-3xl font-bold">{{ usage.totals.downloads }}</p><p class="text-sm text-muted">{{ $t('Installer downloads') }}</p></div></UCard>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <UCard v-if="usage.topPackages.length">
            <template #header><h3 class="font-semibold">{{ $t('Top packages') }}</h3></template>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-muted">
                  <th class="pb-2 font-medium">{{ $t('Package') }}</th>
                  <th class="pb-2 font-medium text-right">{{ $t('Fetches') }}</th>
                  <th class="pb-2 font-medium text-right">{{ $t('Downloads') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in usage.topPackages" :key="p.packageIdentifier!" class="border-t border-default/50">
                  <td class="py-2 pr-3 font-mono break-all">{{ p.packageIdentifier }}</td>
                  <td class="py-2 text-right tabular-nums">{{ p.fetches }}</td>
                  <td class="py-2 text-right tabular-nums">{{ p.downloads }}</td>
                </tr>
              </tbody>
            </table>
          </UCard>

          <div class="space-y-6">
            <UCard v-if="usage.byWingetVersion.length">
              <template #header><h3 class="font-semibold">{{ $t('winget versions') }}</h3></template>
              <div class="space-y-2">
                <div v-for="w in usage.byWingetVersion" :key="w.wingetVersion!" class="space-y-1">
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-mono">{{ w.wingetVersion }}</span>
                    <span class="text-muted tabular-nums">{{ w.count }}</span>
                  </div>
                  <div class="h-2 rounded bg-elevated">
                    <div class="h-2 rounded bg-primary/60" :style="{ width: `${pct(w.count, usage.byWingetVersion)}%` }" />
                  </div>
                </div>
              </div>
            </UCard>

            <UCard v-if="usage.bySite.length">
              <template #header><h3 class="font-semibold">{{ $t('Sites') }}</h3></template>
              <div class="space-y-2">
                <div v-for="s in usage.bySite" :key="s.site!" class="space-y-1">
                  <div class="flex items-center justify-between text-sm">
                    <span>{{ s.site }}</span>
                    <span class="text-muted tabular-nums">{{ s.count }}</span>
                  </div>
                  <div class="h-2 rounded bg-elevated">
                    <div class="h-2 rounded bg-primary/60" :style="{ width: `${pct(s.count, usage.bySite)}%` }" />
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
