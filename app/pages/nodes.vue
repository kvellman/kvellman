<script setup lang="ts">
// Edge-node management (admin only). One page: pick a node, manage which packages it
// mirrors (scope) and pre-stage versions, all via transfer lists + a package→version→installer
// drill-down. Register issues a one-time enrollment key; revoke removes the node.
definePageMeta({
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value?.role !== 'admin') return navigateTo('/')
    },
  ],
})
useHead({ title: () => t('Edge nodes') })

interface Mirrored {
  packageIdentifier: string
  packageVersion: string
  bytes?: number
}
interface NodeRow {
  id: number
  name: string
  status: 'pending' | 'active' | 'revoked'
  lastSeenAt: string | null
  enrolledAt: string | null
  createdAt: string
  lastInfo: Record<string, unknown> | null
  scopeAll: boolean
  scopePackages: string[]
  scopeTags: string[]
  filterArchitectures: string[]
  filterScopes: string[]
  pending: { packageIdentifier: string; packageVersion: string }[]
}
const ARCH_OPTIONS = ['x86', 'x64', 'arm', 'arm64', 'neutral']
const SCOPE_OPTIONS = ['user', 'machine']
interface PkgRow {
  packageIdentifier: string
  packageName: string
  publisher: string
  tags: string[]
}
interface VersionRow {
  packageVersion: string
  approvalStatus: string
  installerCount: number
}
interface InstallerRow {
  architecture?: string
  installerType?: string
  scope?: string
  installerLocale?: string
}

const { t } = useI18n()
const toast = useToast()
const origin = useRequestURL().origin
const { data: list, refresh } = await useFetch<NodeRow[]>('/api/nodes', { default: () => [] })
const { data: pkgs } = await useFetch<PkgRow[]>('/api/packages', { default: () => [] })

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fb
}
async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: t('Copied'), icon: 'i-lucide-check', color: 'success' })
}
function fmtTime(iso: string | null): string {
  return iso ? String(iso).slice(0, 16).replace('T', ' ') : '—'
}
function fmtBytes(b: number): string {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)))
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}
const statusColor = { pending: 'warning', active: 'success', revoked: 'neutral' } as const

// --- Selected node ---
const selectedNodeId = ref<number>()
watchEffect(() => {
  if ((selectedNodeId.value == null || !list.value.some((n) => n.id === selectedNodeId.value)) && list.value.length) {
    selectedNodeId.value = list.value[0]!.id
  }
})
const node = computed(() => list.value.find((n) => n.id === selectedNodeId.value) ?? null)
const nodeItems = computed(() => list.value.map((n) => ({ label: n.name, value: n.id })))

function mirroredList(n: NodeRow | null): Mirrored[] {
  const m = (n?.lastInfo as { mirrored?: Mirrored[] } | null)?.mirrored
  return Array.isArray(m) ? m : []
}
function pendingList(n: NodeRow | null): Mirrored[] {
  return Array.isArray(n?.pending) ? n!.pending : []
}
const cacheBytes = computed(() => mirroredList(node.value).reduce((s, m) => s + (m.bytes ?? 0), 0))
function info<T = unknown>(key: string): T | undefined {
  return (node.value?.lastInfo as Record<string, T> | null)?.[key]
}

// --- Scope (package level) ---
const savingScope = ref(false)
async function patchScope(patch: Record<string, unknown>) {
  if (!node.value) return
  savingScope.value = true
  try {
    await $fetch(`/api/nodes/${node.value.id}`, { method: 'PATCH', body: patch })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Update failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    savingScope.value = false
  }
}
const scopeAll = computed({
  get: () => node.value?.scopeAll ?? true,
  set: (v: boolean) => void patchScope({ scopeAll: v }),
})
const addedIds = computed(() => node.value?.scopePackages ?? [])
const addedPkgs = computed<PkgRow[]>(() => {
  if (scopeAll.value) return pkgs.value
  return addedIds.value.map(
    (id) => pkgs.value.find((p) => p.packageIdentifier === id) ?? { packageIdentifier: id, packageName: id, publisher: '', tags: [] },
  )
})
const availSearch = ref('')
const availablePkgs = computed<PkgRow[]>(() => {
  if (scopeAll.value) return []
  const q = availSearch.value.trim().toLowerCase()
  return pkgs.value.filter(
    (p) =>
      !addedIds.value.includes(p.packageIdentifier) &&
      (!q || p.packageIdentifier.toLowerCase().includes(q) || (p.packageName ?? '').toLowerCase().includes(q)),
  )
})
async function addPkg(id: string) {
  await patchScope({ scopeAll: false, scopePackages: [...addedIds.value, id] })
}
async function removePkg(id: string) {
  await patchScope({ scopePackages: addedIds.value.filter((x) => x !== id) })
  if (selectedPkg.value === id) selectedPkg.value = null
}

// Installer filter (applies to lazy + push)
const filterArch = computed({
  get: () => node.value?.filterArchitectures ?? [],
  set: (v: string[]) => void patchScope({ filterArchitectures: v }),
})
const filterScopes = computed({
  get: () => node.value?.filterScopes ?? [],
  set: (v: string[]) => void patchScope({ filterScopes: v }),
})

// Tags (advanced)
const tags = ref('')
watch(node, (n) => { tags.value = (n?.scopeTags ?? []).join(', ') }, { immediate: true })
async function saveTags() {
  await patchScope({ scopeTags: tags.value.split(',').map((s) => s.trim()).filter(Boolean) })
  toast.add({ title: t('Scope updated'), icon: 'i-lucide-check', color: 'success' })
}

// --- Drill-down: versions of the selected package ---
const selectedPkg = ref<string | null>(null)
const versions = ref<VersionRow[]>([])
const loadingVers = ref(false)
async function selectPkg(id: string) {
  selectedPkg.value = id
  openVer.value = null
  loadingVers.value = true
  try {
    const p = await $fetch<{ versions: VersionRow[] }>(`/api/packages/${encodeURIComponent(id)}`)
    versions.value = p.versions.filter((v) => v.approvalStatus === 'approved')
  } catch {
    versions.value = []
  } finally {
    loadingVers.value = false
  }
}
function verCached(ver: string): Mirrored | undefined {
  return mirroredList(node.value).find((m) => m.packageIdentifier === selectedPkg.value && m.packageVersion === ver)
}
function verPending(ver: string): boolean {
  return pendingList(node.value).some((m) => m.packageIdentifier === selectedPkg.value && m.packageVersion === ver)
}
const busyVer = ref('')
async function pushVer(ver: string) {
  if (!node.value || !selectedPkg.value) return
  busyVer.value = ver
  try {
    const r = await $fetch<{ installers: number }>(`/api/nodes/${node.value.id}/mirror`, {
      method: 'POST',
      body: { packageIdentifier: selectedPkg.value, packageVersion: ver },
    })
    toast.add({ title: t('Mirror requested ({n} installers)', { n: r.installers }), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Push failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    busyVer.value = ''
  }
}
async function unmirrorVer(ver: string) {
  if (!node.value || !selectedPkg.value) return
  busyVer.value = ver
  try {
    await $fetch(`/api/nodes/${node.value.id}/mirror`, {
      method: 'DELETE',
      query: { packageIdentifier: selectedPkg.value, packageVersion: ver },
    })
    toast.add({ title: t('Removal requested'), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Removal failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    busyVer.value = ''
  }
}

// Installers of a version (expand)
const openVer = ref<string | null>(null)
const installers = ref<InstallerRow[]>([])
async function toggleVer(ver: string) {
  if (openVer.value === ver) {
    openVer.value = null
    return
  }
  openVer.value = ver
  installers.value = []
  try {
    const d = await $fetch<{ installers: InstallerRow[] }>(
      `/api/packages/${encodeURIComponent(selectedPkg.value!)}/versions/${encodeURIComponent(ver)}`,
    )
    installers.value = d.installers ?? []
  } catch {
    installers.value = []
  }
}

// --- Register a node → one-time key ---
const showRegister = ref(false)
const name = ref('')
const creating = ref(false)
const created = ref<{ name: string; enrollmentKey: string } | null>(null)
async function createNode() {
  if (!name.value.trim()) return
  creating.value = true
  try {
    const res = await $fetch<{ name: string; enrollmentKey: string }>('/api/nodes', {
      method: 'POST',
      body: { name: name.value.trim() },
    })
    created.value = res
    name.value = ''
    showRegister.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Create failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    creating.value = false
  }
}
const enrollCmd = computed(() =>
  created.value ? `ORIGIN_URL=${origin} ENROLLMENT_KEY=${created.value.enrollmentKey} pnpm dev` : '',
)

// --- Revoke ---
const confirmRevoke = ref<NodeRow | null>(null)
const revoking = ref(false)
async function revokeNode() {
  if (!confirmRevoke.value) return
  revoking.value = true
  try {
    await $fetch(`/api/nodes/${confirmRevoke.value.id}`, { method: 'DELETE' })
    toast.add({ title: t('Node revoked'), icon: 'i-lucide-check', color: 'success' })
    confirmRevoke.value = null
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Delete failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold">{{ $t('Edge nodes') }}</h1>
        <p class="text-muted">{{ $t('Local mirror nodes that cache from this origin.') }}</p>
      </div>
      <UButton icon="i-lucide-plus" @click="showRegister = true">{{ $t('Register node') }}</UButton>
    </header>

    <UAlert
      v-if="created"
      color="success"
      variant="subtle"
      icon="i-lucide-key-round"
      :title="$t('Enrollment key for “{name}” — shown once', { name: created.name })"
    >
      <template #description>
        <div class="mt-2 space-y-2">
          <div class="flex items-start gap-2">
            <pre class="flex-1 overflow-x-auto rounded bg-elevated p-2 font-mono text-xs">{{ created.enrollmentKey }}</pre>
            <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="soft" @click="copy(created.enrollmentKey)">{{ $t('Copy') }}</UButton>
          </div>
          <p class="text-xs text-muted">{{ $t('Provide it to the node at install time (with ORIGIN_URL):') }}</p>
          <div class="flex items-start gap-2">
            <pre class="flex-1 overflow-x-auto rounded bg-elevated p-2 font-mono text-xs">{{ enrollCmd }}</pre>
            <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" @click="copy(enrollCmd)">{{ $t('Copy') }}</UButton>
          </div>
          <UButton size="xs" color="neutral" variant="ghost" @click="created = null">{{ $t('Dismiss') }}</UButton>
        </div>
      </template>
    </UAlert>

    <p v-if="!list.length" class="text-center text-muted py-10">{{ $t('No nodes registered yet.') }}</p>

    <template v-else>
      <!-- Node selector + health -->
      <UCard>
        <div class="flex flex-wrap items-center gap-4">
          <UFormField :label="$t('Node')">
            <USelect v-model="selectedNodeId" :items="nodeItems" class="min-w-56" />
          </UFormField>
          <div v-if="node" class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm pt-5">
            <span><UBadge :color="statusColor[node.status]" variant="subtle" size="sm">{{ $t(`node.${node.status}`) }}</UBadge></span>
            <span class="text-muted">{{ $t('Last seen') }}: {{ fmtTime(node.lastSeenAt) }}</span>
            <span class="text-muted">{{ $t('Indexed') }}: {{ info('indexedPackages') ?? 0 }}</span>
            <span class="text-muted">{{ $t('Cache') }}: {{ fmtBytes(cacheBytes) }}</span>
            <span v-if="info('version')" class="text-muted">v{{ info('version') }}</span>
          </div>
          <UButton
            v-if="node" icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" class="ml-auto pt-2"
            @click="confirmRevoke = node"
          >
            {{ $t('Revoke') }}
          </UButton>
        </div>
      </UCard>

      <template v-if="node">
        <!-- Scope: transfer lists -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <h2 class="font-semibold">{{ $t('Mirrored packages (scope)') }}</h2>
              <USwitch v-model="scopeAll" :label="$t('Mirror all approved packages')" :loading="savingScope" />
            </div>
          </template>

          <div v-if="scopeAll" class="text-sm text-muted">
            {{ $t('All approved packages are in this node’s scope. Turn the switch off to choose individually.') }}
          </div>

          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Available -->
            <div class="rounded border border-default">
              <div class="border-b border-default p-2">
                <p class="text-xs font-medium text-muted mb-1">{{ $t('Available') }}</p>
                <UInput v-model="availSearch" size="xs" icon="i-lucide-search" :placeholder="$t('Search packages')" class="w-full" />
              </div>
              <ul class="max-h-72 overflow-y-auto divide-y divide-default/50">
                <li v-for="p in availablePkgs" :key="p.packageIdentifier" class="flex items-center gap-2 p-2">
                  <UButton icon="i-lucide-arrow-right" size="xs" color="primary" variant="soft" :aria-label="$t('Add')" @click="addPkg(p.packageIdentifier)" />
                  <div class="min-w-0">
                    <p class="truncate text-sm">{{ p.packageName || p.packageIdentifier }}</p>
                    <p class="truncate font-mono text-xs text-muted">{{ p.packageIdentifier }}</p>
                  </div>
                </li>
                <li v-if="!availablePkgs.length" class="p-3 text-center text-xs text-muted">{{ $t('Nothing to add.') }}</li>
              </ul>
            </div>

            <!-- Added -->
            <div class="rounded border border-default">
              <div class="border-b border-default p-2">
                <p class="text-xs font-medium text-muted">{{ $t('Added') }} ({{ addedPkgs.length }})</p>
              </div>
              <ul class="max-h-72 overflow-y-auto divide-y divide-default/50">
                <li
                  v-for="p in addedPkgs" :key="p.packageIdentifier"
                  class="flex items-center gap-2 p-2 cursor-pointer hover:bg-elevated/50"
                  :class="{ 'bg-elevated': selectedPkg === p.packageIdentifier }"
                  @click="selectPkg(p.packageIdentifier)"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm">{{ p.packageName || p.packageIdentifier }}</p>
                    <p class="truncate font-mono text-xs text-muted">{{ p.packageIdentifier }}</p>
                  </div>
                  <UButton icon="i-lucide-arrow-left" size="xs" color="neutral" variant="ghost" :aria-label="$t('Remove')" @click.stop="removePkg(p.packageIdentifier)" />
                </li>
                <li v-if="!addedPkgs.length" class="p-3 text-center text-xs text-muted">{{ $t('No packages selected.') }}</li>
              </ul>
            </div>
          </div>

          <template v-if="scopeAll">
            <div class="mt-4">
              <UFormField :label="$t('Added')">
                <ul class="max-h-60 overflow-y-auto divide-y divide-default/50 rounded border border-default">
                  <li
                    v-for="p in addedPkgs" :key="p.packageIdentifier"
                    class="p-2 cursor-pointer hover:bg-elevated/50 text-sm"
                    :class="{ 'bg-elevated': selectedPkg === p.packageIdentifier }"
                    @click="selectPkg(p.packageIdentifier)"
                  >
                    {{ p.packageName || p.packageIdentifier }}
                    <span class="font-mono text-xs text-muted"> · {{ p.packageIdentifier }}</span>
                  </li>
                </ul>
              </UFormField>
            </div>
          </template>

          <div class="mt-4 flex items-end gap-2">
            <UFormField :label="$t('Tags')" :hint="$t('Also mirror packages with any of these tags (comma-separated)')" class="flex-1">
              <UInput v-model="tags" placeholder="office, security" class="w-full" />
            </UFormField>
            <UButton color="neutral" variant="soft" icon="i-lucide-save" :loading="savingScope" @click="saveTags">{{ $t('Save') }}</UButton>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField :label="$t('Architectures')" :hint="$t('Empty = all. Only mirror these installer architectures.')">
              <USelectMenu v-model="filterArch" :items="ARCH_OPTIONS" multiple class="w-full" :placeholder="$t('All architectures')" />
            </UFormField>
            <UFormField :label="$t('Installer scope')" :hint="$t('Empty = all. Only mirror these installer scopes.')">
              <USelectMenu v-model="filterScopes" :items="SCOPE_OPTIONS" multiple class="w-full" :placeholder="$t('All scopes')" />
            </UFormField>
          </div>
        </UCard>

        <!-- Drill-down: versions + installers of the selected package -->
        <UCard v-if="selectedPkg">
          <template #header>
            <h2 class="font-semibold">{{ $t('Versions of {pkg}', { pkg: selectedPkg }) }}</h2>
          </template>

          <p v-if="loadingVers" class="text-sm text-muted">{{ $t('Loading…') }}</p>
          <p v-else-if="!versions.length" class="text-sm text-muted">{{ $t('No approved versions.') }}</p>

          <ul v-else class="divide-y divide-default/50">
            <li v-for="v in versions" :key="v.packageVersion" class="py-2">
              <div class="flex items-center gap-3">
                <UButton
                  :icon="openVer === v.packageVersion ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  size="xs" color="neutral" variant="ghost" @click="toggleVer(v.packageVersion)"
                />
                <span class="font-medium">{{ v.packageVersion }}</span>

                <UBadge v-if="verCached(v.packageVersion)" color="success" variant="subtle" size="sm">
                  {{ $t('local') }} · {{ fmtBytes(verCached(v.packageVersion)?.bytes ?? 0) }}
                </UBadge>
                <UBadge v-else-if="verPending(v.packageVersion)" color="warning" variant="subtle" size="sm">{{ $t('pending') }}</UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">{{ $t('lazy (on demand)') }}</UBadge>

                <div class="ml-auto flex gap-1">
                  <UButton
                    v-if="!verCached(v.packageVersion) && !verPending(v.packageVersion)"
                    size="xs" color="primary" variant="soft" icon="i-lucide-download"
                    :loading="busyVer === v.packageVersion" @click="pushVer(v.packageVersion)"
                  >
                    {{ $t('Mirror') }}
                  </UButton>
                  <UButton
                    v-else
                    size="xs" color="error" variant="ghost"
                    :icon="verPending(v.packageVersion) ? 'i-lucide-x' : 'i-lucide-trash-2'"
                    :loading="busyVer === v.packageVersion" @click="unmirrorVer(v.packageVersion)"
                  >
                    {{ verPending(v.packageVersion) ? $t('Cancel') : $t('Remove') }}
                  </UButton>
                </div>
              </div>

              <div v-if="openVer === v.packageVersion" class="mt-2 ml-9">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-muted">
                      <th class="py-1 pr-4 font-medium">{{ $t('Architecture') }}</th>
                      <th class="py-1 pr-4 font-medium">{{ $t('Type') }}</th>
                      <th class="py-1 pr-4 font-medium">{{ $t('Scope') }}</th>
                      <th class="py-1 font-medium">{{ $t('Locale') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(inst, i) in installers" :key="i" class="border-t border-default/40">
                      <td class="py-1 pr-4">{{ inst.architecture || '—' }}</td>
                      <td class="py-1 pr-4">{{ inst.installerType || '—' }}</td>
                      <td class="py-1 pr-4">{{ inst.scope || '—' }}</td>
                      <td class="py-1">{{ inst.installerLocale || '—' }}</td>
                    </tr>
                    <tr v-if="!installers.length"><td colspan="4" class="py-2 text-muted">{{ $t('No installers.') }}</td></tr>
                  </tbody>
                </table>
              </div>
            </li>
          </ul>
        </UCard>
        <UCard v-else>
          <p class="text-sm text-muted text-center py-4">{{ $t('Select a package on the right to manage its versions.') }}</p>
        </UCard>
      </template>
    </template>

    <!-- Register modal -->
    <UModal :open="showRegister" :title="$t('Register node')" @update:open="(v) => { if (!v) showRegister = false }">
      <template #body>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="createNode">
          <UFormField :label="$t('Name')" class="flex-1 min-w-60">
            <UInput v-model="name" placeholder="munich-edge" autofocus />
          </UFormField>
          <UButton type="submit" :loading="creating" icon="i-lucide-plus">{{ $t('Register node') }}</UButton>
        </form>
      </template>
    </UModal>

    <UModal :open="!!confirmRevoke" :title="$t('Revoke node?')" @update:open="(v) => { if (!v) confirmRevoke = null }">
      <template #body>
        <p class="text-sm text-muted">{{ $t('“{name}” will lose access immediately.', { name: confirmRevoke?.name }) }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmRevoke = null">{{ $t('Cancel') }}</UButton>
          <UButton color="error" :loading="revoking" icon="i-lucide-trash-2" @click="revokeNode">{{ $t('Revoke') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
