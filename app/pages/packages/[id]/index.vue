<script setup lang="ts">
// Read-only package overview (admin view). Lists all versions with a filter; the per-version
// manifest detail lives on /packages/[id]/[version].
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const id = computed(() => String(route.params.id))
useHead({ title: () => id.value })
const { data: pkg, error } = await useFetch(() => `/api/packages/${id.value}`)
const { canWrite } = useAuthz()

// Upstream update for this package (M4-A), if any.
const { data: updates } = await useFetch('/api/updates')
const update = computed(() => updates.value?.updates.find((u) => u.packageIdentifier === id.value))

const confirmDelete = ref(false)
const deleting = ref(false)
async function deletePackage() {
  deleting.value = true
  try {
    await $fetch(`/api/packages/${id.value}`, { method: 'DELETE' })
    toast.add({ title: t('Package deleted'), icon: 'i-lucide-check', color: 'success' })
    await router.push('/packages')
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Delete failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
    deleting.value = false
  }
}

const query = ref('')
const filteredVersions = computed(() => {
  const list = pkg.value?.versions ?? []
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (v) =>
      v.packageVersion.toLowerCase().includes(q) ||
      originMeta(v.origin).label.toLowerCase().includes(q),
  )
})
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <ULink to="/packages" class="text-sm text-muted hover:text-default">{{ $t('← Back to packages') }}</ULink>

    <UAlert v-if="error" color="error" :title="$t('Package not found')" :description="String(error)" />

    <template v-else-if="pkg">
      <header class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <h1 class="text-2xl font-bold">{{ pkg.packageName }}</h1>
          <p class="font-mono text-muted">{{ pkg.packageIdentifier }}</p>
          <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{{ pkg.publisher }}</span>
            <span v-if="pkg.moniker">· {{ pkg.moniker }}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="tag in pkg.tags" :key="tag" color="neutral" variant="subtle" size="sm">
              {{ tag }}
            </UBadge>
          </div>
        </div>
        <UButton v-if="canWrite" icon="i-lucide-trash-2" color="error" variant="soft" @click="confirmDelete = true">
          {{ $t('Delete') }}
        </UButton>
      </header>

      <UAlert
        v-if="update"
        color="warning"
        variant="subtle"
        icon="i-lucide-arrow-up-circle"
        :title="$t('Update available: {version}', { version: update.latestVersion })"
        :description="$t('A newer version is available upstream (current: {version}).', { version: update.currentVersion })"
        :actions="canWrite ? [{
          label: t('Import {version}', { version: update.latestVersion }),
          icon: 'i-lucide-download',
          color: 'warning',
          variant: 'soft',
          to: `/packages/import?id=${encodeURIComponent(update.packageIdentifier)}`,
        }] : []"
      />

      <UModal v-model:open="confirmDelete" :title="$t('Delete package?')">
        <template #body>
          <p class="text-sm text-muted">
            {{ $t('This permanently deletes the package and all its versions.') }}
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="confirmDelete = false">
              {{ $t('Cancel') }}
            </UButton>
            <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="deletePackage">
              {{ $t('Delete') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold">
              {{ $t('Versions ({count})', { count: pkg.versions.length }) }}
            </h2>
            <div class="flex items-center gap-2">
              <UInput
                v-model="query"
                :placeholder="$t('Filter versions…')"
                icon="i-lucide-search"
                size="sm"
                class="w-56"
              />
              <UButton
                v-if="canWrite"
                :to="`/packages/${pkg.packageIdentifier}/versions/new`"
                icon="i-lucide-plus"
                color="primary"
                size="sm"
              >
                {{ $t('Add version') }}
              </UButton>
            </div>
          </div>
        </template>

        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b border-default text-muted">
              <th class="py-2 pr-4 font-medium">{{ $t('Version') }}</th>
              <th class="py-2 pr-4 font-medium">{{ $t('Origin') }}</th>
              <th class="py-2 pr-4 font-medium">{{ $t('Status') }}</th>
              <th class="py-2 pr-4 font-medium">{{ $t('Installers') }}</th>
              <th class="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="v in filteredVersions"
              :key="v.packageVersion"
              class="border-b border-default/50 last:border-0 hover:bg-elevated/50"
            >
              <td class="py-2 pr-4 font-mono">
                <ULink
                  :to="`/packages/${pkg.packageIdentifier}/${encodeURIComponent(v.packageVersion)}`"
                  class="text-primary hover:underline"
                >
                  {{ v.packageVersion }}
                </ULink>
              </td>
              <td class="py-2 pr-4">
                <UBadge
                  :color="originMeta(v.origin).color"
                  variant="subtle"
                  size="sm"
                  :title="$t(originMeta(v.origin).hint)"
                >
                  {{ $t(originMeta(v.origin).label) }}
                </UBadge>
              </td>
              <td class="py-2 pr-4">
                <UBadge
                  :color="approvalMeta(v.approvalStatus).color"
                  variant="subtle"
                  size="sm"
                  :icon="approvalMeta(v.approvalStatus).icon"
                >
                  {{ $t(approvalMeta(v.approvalStatus).label) }}
                </UBadge>
              </td>
              <td class="py-2 pr-4 text-muted">{{ v.installerCount }}</td>
              <td class="py-2 text-right">
                <ULink
                  :to="`/packages/${pkg.packageIdentifier}/${encodeURIComponent(v.packageVersion)}`"
                  class="text-sm text-muted hover:text-default"
                >
                  {{ $t('Details →') }}
                </ULink>
              </td>
            </tr>
            <tr v-if="filteredVersions.length === 0">
              <td colspan="5" class="py-6 text-center text-muted">
                {{ $t('No versions match “{query}”.', { query }) }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <ChangeHistory :package-identifier="pkg.packageIdentifier" />
    </template>
  </div>
</template>
