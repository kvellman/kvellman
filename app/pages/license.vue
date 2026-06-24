<script setup lang="ts">
// Enterprise license (admin only). Paste a signed license token to activate paid plugins.
definePageMeta({
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value?.role !== 'admin') return navigateTo('/')
    },
  ],
})
useHead({ title: () => t('License') })

interface LicenseStatus {
  valid: boolean
  customer?: string
  entitlements: string[]
  expiresAt?: string | null
  expired?: boolean
}

const { t } = useI18n()
const toast = useToast()
const { data: status, refresh } = await useFetch<LicenseStatus>('/api/license')

const token = ref('')
const saving = ref(false)
const removing = ref(false)

async function save() {
  if (!token.value.trim()) return
  saving.value = true
  try {
    await $fetch('/api/license', { method: 'PUT', body: { token: token.value.trim() } })
    toast.add({ title: t('License installed'), icon: 'i-lucide-check', color: 'success' })
    token.value = ''
    await refresh()
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Invalid license')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
async function remove() {
  removing.value = true
  try {
    await $fetch('/api/license', { method: 'DELETE' })
    toast.add({ title: t('License removed'), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: t('Remove failed'), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    removing.value = false
  }
}
function fmtDate(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 10) : t('never')
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('License') }}</h1>
      <p class="text-muted">{{ $t('Activate paid plugins with a signed license. Works offline.') }}</p>
    </header>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('Status') }}</h2></template>
      <div v-if="status?.valid" class="space-y-3 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="status.expired ? 'error' : 'success'" variant="subtle" :icon="status.expired ? 'i-lucide-circle-x' : 'i-lucide-circle-check'">
            {{ status.expired ? $t('Expired') : $t('Active') }}
          </UBadge>
          <span class="text-muted">{{ status.customer }}</span>
        </div>
        <p class="text-muted">{{ $t('Valid until: {date}', { date: fmtDate(status.expiresAt) }) }}</p>
        <div>
          <p class="mb-1 text-xs font-medium text-muted">{{ $t('Entitlements') }}</p>
          <div v-if="status.entitlements.length" class="flex flex-wrap gap-1">
            <UBadge v-for="e in status.entitlements" :key="e" :color="status.expired ? 'neutral' : 'primary'" variant="subtle" size="sm">{{ e }}</UBadge>
          </div>
          <span v-else class="text-muted">—</span>
        </div>
        <UButton color="error" variant="soft" size="sm" icon="i-lucide-trash-2" :loading="removing" @click="remove">
          {{ $t('Remove license') }}
        </UButton>
      </div>
      <p v-else class="text-sm text-muted">{{ $t('No license installed — running the open-core edition.') }}</p>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('Install license') }}</h2></template>
      <div class="space-y-3">
        <UTextarea v-model="token" :rows="4" class="w-full font-mono" :placeholder="$t('Paste your license token…')" />
        <div class="flex justify-end">
          <UButton :loading="saving" :disabled="!token.trim()" icon="i-lucide-key-round" @click="save">{{ $t('Install license') }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
