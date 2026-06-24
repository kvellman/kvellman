<script setup lang="ts">
definePageMeta({ middleware: 'can-write' })
// Import a package version's manifest from microsoft/winget-pkgs. Search uses the locally synced
// winget catalog (upstream_catalog); the actual manifest is fetched from winget-pkgs on import.
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
useHead({ title: () => t('Import package') })

interface CatalogResult {
  packageIdentifier: string
  name: string
  moniker: string | null
  latestVersion: string | null
}

// --- Catalog status + sync -----------------------------------------------------
const { data: status, refresh: refreshStatus } = await useFetch<{
  count: number
  syncedAt: string | null
  auto: { enabled: boolean; intervalHours: number }
}>('/api/upstream/catalog-status')
const syncing = ref(false)
async function syncCatalog() {
  syncing.value = true
  try {
    const res = await $fetch<{ count: number }>('/api/upstream/sync', { method: 'POST' })
    toast.add({ title: t('Catalog synced ({count} packages)', { count: res.count }), icon: 'i-lucide-check', color: 'success' })
    await refreshStatus()
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Sync failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    syncing.value = false
  }
}

// --- Catalog search ------------------------------------------------------------
const search = ref('')
const results = ref<CatalogResult[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (!q.trim()) {
      results.value = []
      return
    }
    try {
      const r = await $fetch<{ results: CatalogResult[] }>('/api/upstream/search', { query: { q } })
      results.value = r.results
    } catch {
      results.value = []
    }
  }, 250)
})
function pick(result: CatalogResult) {
  identifier.value = result.packageIdentifier
  results.value = []
  search.value = ''
  lookup()
}

// --- Version lookup + import ---------------------------------------------------
const identifier = ref('')
const versions = ref<string[] | null>(null)
const selected = ref('')
const lookingUp = ref(false)
const importing = ref(false)

async function lookup() {
  const id = identifier.value.trim()
  if (!id) return
  identifier.value = id
  lookingUp.value = true
  versions.value = null
  selected.value = ''
  try {
    const res = await $fetch<{ versions: string[] }>('/api/upstream/versions', { query: { id } })
    versions.value = res.versions
    selected.value = res.versions[0] ?? ''
  } catch (e: unknown) {
    versions.value = []
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Lookup failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    lookingUp.value = false
  }
}

// Prefill + auto-lookup when arriving from an "update available" link (/packages/import?id=...).
const route = useRoute()
onMounted(() => {
  const id = route.query.id
  if (typeof id === 'string' && id.trim()) {
    identifier.value = id.trim()
    lookup()
  }
})

async function doImport() {
  if (!selected.value) return
  importing.value = true
  try {
    const res = await $fetch<{ packageIdentifier: string; packageVersion: string }>('/api/upstream/import', {
      method: 'POST',
      body: { packageIdentifier: identifier.value.trim(), version: selected.value },
    })
    toast.add({ title: t('Package imported'), icon: 'i-lucide-check', color: 'success' })
    await router.push(`/packages/${res.packageIdentifier}/${encodeURIComponent(res.packageVersion)}`)
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Import failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-6 space-y-6">
    <ULink to="/packages" class="text-sm text-muted hover:text-default">{{ $t('← Back to packages') }}</ULink>

    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold">{{ $t('Import from winget-pkgs') }}</h1>
        <p class="text-muted">
          {{ $t("Import a package's manifest from the public winget-pkgs repository.") }}
        </p>
      </div>
      <div class="text-right text-xs text-muted shrink-0">
        <UButton
          icon="i-lucide-refresh-cw"
          size="sm"
          color="neutral"
          variant="soft"
          :loading="syncing"
          @click="syncCatalog"
        >
          {{ $t('Sync catalog') }}
        </UButton>
        <p class="mt-1">{{ $t('{count} packages in catalog', { count: status?.count ?? 0 }) }}</p>
        <p>
          {{
            status?.auto?.enabled
              ? $t('Auto-sync: every {hours} h', { hours: status.auto.intervalHours })
              : $t('Auto-sync off')
          }}
        </p>
      </div>
    </header>

    <UCard>
      <div class="space-y-3">
        <UAlert
          v-if="(status?.count ?? 0) === 0"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :description="$t('Catalog is empty — sync it to enable search.')"
        />

        <UFormField :label="$t('Search packages')">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="$t('Search the winget catalog…')"
            :disabled="(status?.count ?? 0) === 0"
          />
        </UFormField>

        <ul v-if="results.length" class="divide-y divide-default/50 rounded border border-default/50">
          <li v-for="r in results" :key="r.packageIdentifier">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-elevated/50"
              @click="pick(r)"
            >
              <span>
                <span class="font-medium">{{ r.name }}</span>
                <span class="ml-2 font-mono text-muted">{{ r.packageIdentifier }}</span>
              </span>
              <span class="font-mono text-xs text-muted">{{ r.latestVersion }}</span>
            </button>
          </li>
        </ul>

        <UFormField :label="$t('Or enter a package identifier manually')">
          <div class="flex items-center gap-2">
            <UInput
              v-model="identifier"
              placeholder="Publisher.Package"
              class="font-mono flex-1"
              @keydown.enter="lookup"
            />
            <UButton icon="i-lucide-search" :loading="lookingUp" :disabled="!identifier.trim()" @click="lookup">
              {{ $t('Look up') }}
            </UButton>
          </div>
        </UFormField>

        <UAlert
          v-if="versions !== null && versions.length === 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-search-x"
          :description="$t('No versions found upstream — check the identifier.')"
        />

        <template v-if="versions && versions.length">
          <UFormField :label="$t('Version')">
            <USelect v-model="selected" :items="versions" class="w-60" />
          </UFormField>
          <div class="flex justify-end">
            <UButton icon="i-lucide-download" :loading="importing" :disabled="!selected" @click="doImport">
              {{ $t('Import') }}
            </UButton>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
