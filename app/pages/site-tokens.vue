<script setup lang="ts">
// Site token management (Community-level, admin only). Create/edit/revoke tokens that select the
// per-site delivery context. Scoping, subnet/mTLS resolution and tenancy stay Enterprise.
definePageMeta({
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value?.role !== 'admin') return navigateTo('/')
    },
  ],
})
useHead({ title: () => t('Site tokens') })

interface SiteToken {
  token: string
  site: string
  location: string
  defaultLocale: string
  repoUrl: string
  mirrorLocally: boolean
}

const { t } = useI18n()
const toast = useToast()
const origin = useRequestURL().origin
const { data: tokens, refresh } = await useFetch<SiteToken[]>('/api/site-tokens')

function errMsg(e: unknown, fallback: string) {
  return (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}
async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: t('Copied'), icon: 'i-lucide-check', color: 'success' })
}

// --- Create ---
const form = reactive({ token: '', site: '', location: '', defaultLocale: 'en-US', repoUrl: origin, mirrorLocally: false })
const creating = ref(false)
async function createToken() {
  creating.value = true
  try {
    await $fetch('/api/site-tokens', { method: 'POST', body: { ...form } })
    toast.add({ title: t('Site token created'), icon: 'i-lucide-check', color: 'success' })
    Object.assign(form, { token: '', site: '', location: '', defaultLocale: 'en-US', repoUrl: origin, mirrorLocally: false })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Create failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    creating.value = false
  }
}

// --- Edit (modal) ---
const editing = ref<SiteToken | null>(null)
const editForm = reactive({ site: '', location: '', defaultLocale: '', repoUrl: '', mirrorLocally: false })
const saving = ref(false)
function openEdit(tk: SiteToken) {
  editing.value = tk
  Object.assign(editForm, { site: tk.site, location: tk.location, defaultLocale: tk.defaultLocale, repoUrl: tk.repoUrl, mirrorLocally: tk.mirrorLocally })
}
async function saveEdit() {
  if (!editing.value) return
  saving.value = true
  try {
    await $fetch(`/api/site-tokens/${editing.value.token}`, { method: 'PATCH', body: { ...editForm } })
    toast.add({ title: t('Site token updated'), icon: 'i-lucide-check', color: 'success' })
    editing.value = null
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Update failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}

// --- Delete ---
const confirmDelete = ref<SiteToken | null>(null)
const deleting = ref(false)
async function deleteToken() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/site-tokens/${confirmDelete.value.token}`, { method: 'DELETE' })
    toast.add({ title: t('Site token revoked'), icon: 'i-lucide-check', color: 'success' })
    confirmDelete.value = null
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Delete failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('Site tokens') }}</h1>
      <p class="text-muted">{{ $t('Tokens select the per-site delivery context used in source URLs.') }}</p>
    </header>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('Add site token') }}</h2></template>
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="createToken">
        <UFormField :label="$t('Token')" :hint="$t('Optional — generated if empty')">
          <UInput v-model="form.token" placeholder="munich-floor3" class="font-mono" />
        </UFormField>
        <UFormField :label="$t('Site')"><UInput v-model="form.site" /></UFormField>
        <UFormField :label="$t('Location')"><UInput v-model="form.location" /></UFormField>
        <UFormField :label="$t('Default locale')"><UInput v-model="form.defaultLocale" placeholder="en-US" /></UFormField>
        <UFormField :label="$t('Repo URL')" class="sm:col-span-2"><UInput v-model="form.repoUrl" class="font-mono" /></UFormField>
        <div class="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
          <div>
            <USwitch v-model="form.mirrorLocally" :label="$t('Mirror installers locally (planned)')" />
            <p class="mt-1 text-xs text-muted">{{ $t('Not active yet — reserved for Enterprise edge/mirror nodes.') }}</p>
          </div>
          <UButton type="submit" :loading="creating" icon="i-lucide-plus">{{ $t('Add site token') }}</UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-default text-muted">
            <th class="py-2 pr-4 font-medium">{{ $t('Token') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Site') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Location') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Locale') }}</th>
            <th class="py-2 font-medium text-right">{{ $t('Actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tk in tokens" :key="tk.token" class="border-b border-default/50 last:border-0">
            <td class="py-2 pr-4 font-mono">{{ tk.token }}</td>
            <td class="py-2 pr-4">{{ tk.site }}</td>
            <td class="py-2 pr-4 text-muted">{{ tk.location }}</td>
            <td class="py-2 pr-4 text-muted">{{ tk.defaultLocale }}</td>
            <td class="py-2 text-right whitespace-nowrap">
              <UButton
                icon="i-lucide-copy"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="`${origin}/api/${tk.token}`"
                @click="copy(`${origin}/api/${tk.token}`)"
              >
                {{ $t('Copy URL') }}
              </UButton>
              <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="openEdit(tk)">
                {{ $t('Edit') }}
              </UButton>
              <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" @click="confirmDelete = tk" />
            </td>
          </tr>
          <tr v-if="!tokens?.length">
            <td colspan="5" class="py-6 text-center text-muted">{{ $t('No site tokens yet.') }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal :open="!!editing" :title="$t('Edit site token')" @update:open="(v) => { if (!v) editing = null }">
      <template #body>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="$t('Token')"><UInput :model-value="editing?.token" disabled class="font-mono" /></UFormField>
          <UFormField :label="$t('Default locale')"><UInput v-model="editForm.defaultLocale" /></UFormField>
          <UFormField :label="$t('Site')"><UInput v-model="editForm.site" /></UFormField>
          <UFormField :label="$t('Location')"><UInput v-model="editForm.location" /></UFormField>
          <UFormField :label="$t('Repo URL')" class="sm:col-span-2"><UInput v-model="editForm.repoUrl" class="font-mono" /></UFormField>
          <USwitch v-model="editForm.mirrorLocally" :label="$t('Mirror installers locally (planned)')" class="sm:col-span-2" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="editing = null">{{ $t('Cancel') }}</UButton>
          <UButton :loading="saving" icon="i-lucide-save" @click="saveEdit">{{ $t('Save') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal :open="!!confirmDelete" :title="$t('Revoke site token?')" @update:open="(v) => { if (!v) confirmDelete = null }">
      <template #body>
        <p class="text-sm text-muted">
          {{ $t('Clients using “{token}” will fall back to the default context.', { token: confirmDelete?.token }) }}
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmDelete = null">{{ $t('Cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="deleteToken">{{ $t('Revoke') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
