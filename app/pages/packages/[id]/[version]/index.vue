<script setup lang="ts">
// Read-only single-version detail (raw stored manifest — admin view).
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = computed(() => String(route.params.id))
const version = computed(() => String(route.params.version))
useHead({ title: () => `${id.value} ${version.value}` })
const { data: v, error, refresh } = await useFetch(
  () => `/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}`,
)
const { canWrite } = useAuthz()

function defaultLocale<T extends { isDefault: boolean }>(locales: T[]): T | undefined {
  return locales.find((l) => l.isDefault) ?? locales[0]
}

const showRaw = ref(false)
const toast = useToast()
async function copyRaw() {
  if (!v.value?.rawYaml) return
  await navigator.clipboard.writeText(v.value.rawYaml)
  toast.add({ title: t('Copied raw manifest'), icon: 'i-lucide-check', color: 'success' })
}

// --- Installer binary upload (local origin storage) ---
const busyInstaller = ref<number | null>(null)
async function uploadInstallerFile(installerId: number, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busyInstaller.value = installerId
  try {
    const fd = new FormData()
    fd.append('file', file, file.name)
    await $fetch(`/api/installers/${installerId}/file`, { method: 'POST', body: fd })
    toast.add({ title: t('Installer file uploaded'), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Upload failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    busyInstaller.value = null
  }
}
async function removeInstallerFile(installerId: number) {
  busyInstaller.value = installerId
  try {
    await $fetch(`/api/installers/${installerId}/file`, { method: 'DELETE' })
    toast.add({ title: t('Local file removed'), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: t('Remove failed'), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    busyInstaller.value = null
  }
}

// --- Overlay diff: inline change rendering (DiffField) + a collapsible list ---
const showDiff = ref(false)
const overlayDiff = computed(() => v.value?.overlayDiff ?? [])
const changedFields = computed(() => new Set(overlayDiff.value.map((c) => c.field)))
// Provided to <DiffField> so each value can render its upstream→overlay delta inline.
provide(
  'overlayDiffMap',
  computed(() => new Map(overlayDiff.value.map((c) => [c.field, { upstream: c.upstream, overlay: c.overlay }]))),
)
function isChanged(field: string): boolean {
  return changedFields.value.has(field)
}
// Map a displayed value to its diff field path (matching server diffManifest keys).
const defLocaleCode = computed(() => defaultLocale(v.value?.locales ?? [])?.packageLocale ?? '')
function localePath(field: string): string {
  return `locale[${defLocaleCode.value}].${field}`
}
function installerPath(i: { architecture: string; installerType: string }, field: string): string {
  return `installer[${i.architecture}/${i.installerType}].${field}`
}

// --- Review / approval (M4-B; reason note M5) ---
const reviewing = ref(false)
// Approve/Reject open a dialog to capture an optional reason; Revert applies directly.
const reviewModal = ref(false)
const reviewAction = ref<'approved' | 'rejected'>('approved')
const reviewNote = ref('')
function openReview(action: 'approved' | 'rejected') {
  reviewAction.value = action
  reviewNote.value = ''
  reviewModal.value = true
}
async function setApproval(status: 'approved' | 'rejected' | 'pending', note?: string) {
  reviewing.value = true
  try {
    await $fetch(`/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}/approval`, {
      method: 'POST',
      body: { status, note: note || null },
    })
    toast.add({ title: t('Review updated'), icon: 'i-lucide-check', color: 'success' })
    reviewModal.value = false
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Review failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    reviewing.value = false
  }
}
function fmtTime(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 16).replace('T', ' ') : '—'
}

// --- Reset overlay to upstream ---
const confirmReset = ref(false)
const resetting = ref(false)
async function resetToUpstream() {
  resetting.value = true
  try {
    await $fetch(`/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}/reset`, {
      method: 'POST',
    })
    toast.add({ title: t('Reset complete'), icon: 'i-lucide-check', color: 'success' })
    confirmReset.value = false
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Reset failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    resetting.value = false
  }
}

// --- Save this version's customizations as the package overlay template ---
const savingTemplate = ref(false)
async function saveAsTemplate() {
  savingTemplate.value = true
  try {
    const tpl = await $fetch<{ rules: unknown[] }>(`/api/packages/${id.value}/template`, {
      method: 'POST',
      body: { fromVersion: version.value },
    })
    toast.add({ title: t('Saved as package template ({n} fields)', { n: tpl.rules.length }), icon: 'i-lucide-check', color: 'success' })
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Save failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    savingTemplate.value = false
  }
}

// --- Delete this version ---
const confirmDelete = ref(false)
const deleting = ref(false)
async function deleteVersion() {
  deleting.value = true
  try {
    const res = await $fetch<{ packageDeleted: boolean }>(
      `/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}`,
      { method: 'DELETE' },
    )
    toast.add({ title: t('Version deleted'), icon: 'i-lucide-check', color: 'success' })
    await router.push(res.packageDeleted ? '/packages' : `/packages/${id.value}`)
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Delete failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <ULink :to="`/packages/${id}`" class="text-sm text-muted hover:text-default">
      {{ $t('← Back to {name}', { name: id }) }}
    </ULink>

    <UAlert v-if="error" color="error" :title="$t('Version not found')" :description="String(error)" />

    <template v-else-if="v">
      <header class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold">{{ v.packageName }}</h1>
            <UBadge
              :color="originMeta(v.origin).color"
              variant="subtle"
              :title="$t(originMeta(v.origin).hint)"
            >
              {{ $t(originMeta(v.origin).label) }}
            </UBadge>
          </div>
          <p class="font-mono text-muted">
            {{ v.packageIdentifier }} · <span class="text-default">{{ v.packageVersion }}</span>
          </p>
          <p class="text-sm text-muted">{{ $t(originMeta(v.origin).hint) }}</p>
          <UBadge
            :color="v.specCheck.valid ? 'success' : 'error'"
            variant="subtle"
            :icon="v.specCheck.valid ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'"
          >
            {{
              v.specCheck.valid
                ? $t('Spec valid · {version}', { version: v.specCheck.version })
                : $t('Spec issues ({count})', { count: v.specCheck.errors.length })
            }}
          </UBadge>
          <UBadge
            :color="approvalMeta(v.approval.status).color"
            variant="subtle"
            :icon="approvalMeta(v.approval.status).icon"
            class="ml-2"
          >
            {{ $t(approvalMeta(v.approval.status).label) }}
          </UBadge>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="v.editable && canWrite"
            :to="`/packages/${id}/${encodeURIComponent(v.packageVersion)}/edit`"
            icon="i-lucide-pencil"
            color="primary"
          >
            {{ $t('Edit') }}
          </UButton>
          <UButton
            v-if="canWrite && v.origin === 'overlay'"
            icon="i-lucide-wand-2"
            color="neutral"
            variant="soft"
            :loading="savingTemplate"
            @click="saveAsTemplate"
          >
            {{ $t('Save as template') }}
          </UButton>
          <UButton
            v-if="canWrite"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            @click="confirmDelete = true"
          >
            {{ $t('Delete') }}
          </UButton>
        </div>
      </header>

      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1 text-sm">
            <div class="flex items-center gap-2">
              <UIcon :name="approvalMeta(v.approval.status).icon" class="size-4" />
              <span class="font-medium">{{ $t(approvalMeta(v.approval.status).label) }}</span>
              <span v-if="v.approval.status === 'pending'" class="text-muted">
                · {{ $t('Not delivered to winget clients until approved.') }}
              </span>
            </div>
            <p v-if="v.approval.reviewedBy" class="text-xs text-muted">
              {{ $t('Reviewed by {by} at {time}', { by: v.approval.reviewedBy, time: fmtTime(v.approval.reviewedAt) }) }}
            </p>
            <p v-if="v.approval.note" class="text-sm italic text-muted">“{{ v.approval.note }}”</p>
          </div>
          <div v-if="canWrite" class="flex items-center gap-2">
            <UButton
              v-if="v.approval.status !== 'approved'"
              icon="i-lucide-circle-check"
              color="success"
              :loading="reviewing"
              @click="openReview('approved')"
            >
              {{ $t('Approve') }}
            </UButton>
            <UButton
              v-if="v.approval.status !== 'rejected'"
              icon="i-lucide-circle-x"
              color="error"
              variant="soft"
              :loading="reviewing"
              @click="openReview('rejected')"
            >
              {{ $t('Reject') }}
            </UButton>
            <UButton
              v-if="v.approval.status !== 'pending'"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              :loading="reviewing"
              @click="setApproval('pending')"
            >
              {{ $t('Reset review') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <UModal
        v-model:open="reviewModal"
        :title="reviewAction === 'approved' ? $t('Approve version') : $t('Reject version')"
      >
        <template #body>
          <UFormField
            :label="reviewAction === 'approved' ? $t('Reason for approval') : $t('Reason for rejection')"
            :hint="$t('Optional')"
          >
            <UTextarea
              v-model="reviewNote"
              :rows="3"
              class="w-full"
              :placeholder="reviewAction === 'approved' ? $t('Why is this version approved?') : $t('Why is this version rejected?')"
              autofocus
            />
          </UFormField>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="reviewModal = false">{{ $t('Cancel') }}</UButton>
            <UButton
              :color="reviewAction === 'approved' ? 'success' : 'error'"
              :icon="reviewAction === 'approved' ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
              :loading="reviewing"
              @click="setApproval(reviewAction, reviewNote)"
            >
              {{ reviewAction === 'approved' ? $t('Approve') : $t('Reject') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="confirmDelete" :title="$t('Delete version?')">
        <template #body>
          <p class="text-sm text-muted">
            {{ $t('This permanently deletes this version, its installers/locales and any stored files.') }}
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="confirmDelete = false">
              {{ $t('Cancel') }}
            </UButton>
            <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="deleteVersion">
              {{ $t('Delete') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UAlert
        v-if="!v.specCheck.valid"
        color="error"
        variant="subtle"
        icon="i-lucide-shield-alert"
        :title="$t('Not spec-compliant against winget {version}', { version: v.specCheck.version })"
      >
        <template #description>
          <ul class="list-disc space-y-0.5 pl-4 font-mono text-xs">
            <li v-for="(err, i) in v.specCheck.errors" :key="i">
              <span class="text-muted">{{ err.path }}</span> {{ err.message }}
            </li>
          </ul>
        </template>
      </UAlert>

      <UModal v-model:open="confirmReset" :title="$t('Reset to upstream?')">
        <template #body>
          <p class="text-sm text-muted">
            {{ $t('This discards all customizations and restores the original upstream manifest.') }}
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="confirmReset = false">{{ $t('Cancel') }}</UButton>
            <UButton color="warning" :loading="resetting" icon="i-lucide-rotate-ccw" @click="resetToUpstream">
              {{ $t('Reset to upstream') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UCard v-if="defaultLocale(v.locales)">
        <template #header>
          <h2 class="font-semibold">{{ $t('Manifest') }}</h2>
        </template>
        <div class="space-y-4 text-sm">
          <p v-if="defaultLocale(v.locales)?.shortDescription">
            <DiffField :path="localePath('shortDescription')" :value="defaultLocale(v.locales)?.shortDescription" />
          </p>
          <dl class="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            <div class="flex justify-between gap-4 border-b border-default/40 pb-1">
              <dt class="text-muted">{{ $t('Publisher') }}</dt>
              <dd><DiffField :path="localePath('publisher')" :value="v.publisher" /></dd>
            </div>
            <div class="flex justify-between gap-4 border-b border-default/40 pb-1">
              <dt class="text-muted">{{ $t('License') }}</dt>
              <dd><DiffField :path="localePath('license')" :value="defaultLocale(v.locales)?.license" /></dd>
            </div>
            <div class="flex justify-between gap-4 border-b border-default/40 pb-1">
              <dt class="text-muted">{{ $t('Default locale') }}</dt>
              <dd class="font-mono"><DiffField :path="localePath('packageLocale')" :value="defaultLocale(v.locales)?.packageLocale" /></dd>
            </div>
            <div class="flex justify-between gap-4 border-b border-default/40 pb-1">
              <dt class="text-muted">{{ $t('Moniker') }}</dt>
              <dd><DiffField :path="localePath('moniker')" :value="v.moniker" /></dd>
            </div>
          </dl>
          <div v-if="v.locales.length > 1" class="flex flex-wrap items-center gap-1 pt-1">
            <span class="text-muted">{{ $t('Locales:') }}</span>
            <UBadge
              v-for="l in v.locales"
              :key="l.packageLocale"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ l.packageLocale }}{{ l.isDefault ? ` (${$t('default')})` : '' }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ $t('Installers ({count})', { count: v.installers.length }) }}</h2>
        </template>
        <div class="space-y-6">
          <div
            v-for="(i, idx) in v.installers"
            :key="idx"
            class="space-y-2 border-b border-default/50 pb-4 last:border-0 last:pb-0"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <UBadge :color="isChanged(installerPath(i, 'architecture')) ? 'warning' : 'neutral'" variant="subtle" size="sm">{{ i.architecture }}</UBadge>
              <UBadge :color="isChanged(installerPath(i, 'installerType')) ? 'warning' : 'neutral'" variant="subtle" size="sm">{{ i.installerType }}</UBadge>
              <UBadge v-if="i.scope" :color="isChanged(installerPath(i, 'scope')) ? 'warning' : 'neutral'" variant="outline" size="sm">
                {{ i.scope }}
              </UBadge>
            </div>
            <dl class="space-y-1 text-sm">
              <div class="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt class="w-20 shrink-0 text-muted">URL</dt>
                <dd class="font-mono break-all"><DiffField :path="installerPath(i, 'installerUrl')" :value="i.installerUrl" /></dd>
              </div>
              <div class="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt class="w-20 shrink-0 text-muted">SHA256</dt>
                <dd class="font-mono break-all text-muted"><DiffField :path="installerPath(i, 'installerSha256')" :value="i.installerSha256" /></dd>
              </div>
              <div v-if="i.installerSwitches" class="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt class="w-20 shrink-0 text-muted">Switches</dt>
                <dd class="font-mono break-all"><DiffField :path="installerPath(i, 'installerSwitches')" :value="JSON.stringify(i.installerSwitches)" /></dd>
              </div>
              <div v-if="i.localFile" class="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt class="w-20 shrink-0 text-muted">{{ $t('Local file') }}</dt>
                <dd class="font-mono break-all">{{ i.localFile }}</dd>
              </div>
            </dl>
            <div v-if="canWrite" class="flex items-center gap-2 pt-1">
              <UButton
                icon="i-lucide-upload"
                size="xs"
                color="neutral"
                variant="soft"
                :loading="busyInstaller === i.id"
              >
                <label class="cursor-pointer">
                  {{ i.localFile ? $t('Replace file') : $t('Upload file') }}
                  <input
                    type="file"
                    class="hidden"
                    @change="uploadInstallerFile(i.id, $event)"
                  />
                </label>
              </UButton>
              <UButton
                v-if="i.localFile"
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :loading="busyInstaller === i.id"
                @click="removeInstallerFile(i.id)"
              >
                {{ $t('Remove file') }}
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold">{{ $t('Raw manifest') }}</h2>
              <p class="text-xs text-muted">{{ $t('Singleton YAML · stored form (placeholders unresolved)') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                :icon="showRaw ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showRaw = !showRaw"
              >
                {{ showRaw ? $t('Hide') : $t('Show') }}
              </UButton>
              <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="sm" @click="copyRaw">
                {{ $t('Copy') }}
              </UButton>
            </div>
          </div>
        </template>
        <pre
          v-if="showRaw"
          class="overflow-x-auto rounded bg-elevated/50 p-4 text-xs leading-relaxed"
        >{{ v.rawYaml }}</pre>
      </UCard>

      <UCard v-if="overlayDiff.length">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold">
                {{ $t('Customizations ({count})', { count: overlayDiff.length }) }}
              </h2>
              <p class="text-xs text-muted">{{ $t('Fields overridden vs. the upstream manifest.') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                :icon="showDiff ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showDiff = !showDiff"
              >
                {{ showDiff ? $t('Hide') : $t('Show') }}
              </UButton>
              <UButton
                icon="i-lucide-rotate-ccw"
                size="sm"
                color="warning"
                variant="soft"
                @click="confirmReset = true"
              >
                {{ $t('Reset to upstream') }}
              </UButton>
            </div>
          </div>
        </template>
        <table v-if="showDiff" class="w-full text-sm">
          <thead>
            <tr class="text-left border-b border-default text-muted">
              <th class="py-2 pr-4 font-medium">{{ $t('Field') }}</th>
              <th class="py-2 pr-4 font-medium">{{ $t('Upstream') }}</th>
              <th class="py-2 font-medium">{{ $t('Overlay') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in overlayDiff" :key="i" class="border-b border-default/50 last:border-0 align-top">
              <td class="py-2 pr-4 font-mono">{{ c.field }}</td>
              <td class="py-2 pr-4 font-mono break-all text-muted">{{ c.upstream }}</td>
              <td class="py-2 font-mono break-all">{{ c.overlay }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <ChangeHistory :package-identifier="v.packageIdentifier" :package-version="v.packageVersion" />
    </template>
  </div>
</template>
