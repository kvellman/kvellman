<script setup lang="ts">
// Read-only package list (M1 read-UI increment). Data from the internal /api/packages.
const { t } = useI18n()
useHead({ title: () => t('Packages') })
const { data: packages, status, error, refresh } = await useFetch('/api/packages')

const { canWrite } = useAuthz()

// Upstream updates available (M4-A) — map identifier → latest upstream version for a row badge.
const { data: updates } = await useFetch('/api/updates')
const updateMap = computed(
  () => new Map((updates.value?.updates ?? []).map((u) => [u.packageIdentifier, u.latestVersion])),
)

// Client-side filter across identifier / name / publisher / tags.
const filter = ref('')
const filteredPackages = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const list = packages.value ?? []
  if (!q) return list
  return list.filter((p) =>
    [p.packageIdentifier, p.packageName, p.publisher, ...(p.tags ?? [])]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q)),
  )
})
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('Packages') }}</h1>
        <p class="text-muted">{{ $t('{count} packages', { count: packages?.length ?? 0 }) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UInput
          v-model="filter"
          icon="i-lucide-search"
          :placeholder="$t('Filter by name, publisher or tag…')"
          class="w-64"
        />
        <UButton color="neutral" variant="soft" :loading="status === 'pending'" @click="refresh()">
          {{ $t('Refresh') }}
        </UButton>
        <UButton v-if="canWrite" to="/packages/import" icon="i-lucide-download" color="neutral" variant="soft">
          {{ $t('Import from winget-pkgs') }}
        </UButton>
        <UButton v-if="canWrite" to="/packages/new" icon="i-lucide-plus" color="primary">
          {{ $t('New package') }}
        </UButton>
      </div>
    </header>

    <UAlert v-if="error" color="error" :title="$t('Failed to load packages')" :description="String(error)" />

    <UCard v-else>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-default text-muted">
            <th class="py-2 pr-4 font-medium">{{ $t('Identifier') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Name') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Publisher') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Version') }}</th>
            <th class="py-2 font-medium">{{ $t('Tags') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filteredPackages"
            :key="p.packageIdentifier"
            class="border-b border-default/50 last:border-0"
          >
            <td class="py-2 pr-4 font-mono">
              <ULink :to="`/packages/${p.packageIdentifier}`" class="text-primary hover:underline">
                {{ p.packageIdentifier }}
              </ULink>
            </td>
            <td class="py-2 pr-4">{{ p.packageName }}</td>
            <td class="py-2 pr-4 text-muted">{{ p.publisher }}</td>
            <td class="py-2 pr-4">
              <div class="flex items-center gap-2">
                <span>{{ p.latestVersion ?? '—' }}</span>
                <UBadge
                  v-if="updateMap.has(p.packageIdentifier)"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-arrow-up-circle"
                >
                  {{ $t('Update: {version}', { version: updateMap.get(p.packageIdentifier) }) }}
                </UBadge>
              </div>
            </td>
            <td class="py-2">
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="tag in p.tags" :key="tag" color="neutral" variant="subtle" size="sm">
                  {{ tag }}
                </UBadge>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredPackages.length">
            <td colspan="5" class="py-6 text-center text-muted">
              {{ filter ? $t('No packages match “{query}”.', { query: filter }) : $t('No packages yet.') }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
