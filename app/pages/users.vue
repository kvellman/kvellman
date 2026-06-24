<script setup lang="ts">
// User management (M5-B, admin only). Non-admins are redirected away; the API is admin-gated too.
definePageMeta({
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value?.role !== 'admin') return navigateTo('/')
    },
  ],
})
useHead({ title: () => t('Users') })

interface UserRow {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'reviewer' | 'viewer'
  createdAt: string
}

const { t } = useI18n()
const toast = useToast()
const { user: me } = useUserSession()
const { data: users, refresh } = await useFetch<UserRow[]>('/api/users')

const roleItems = [
  { label: t('Viewer'), value: 'viewer' },
  { label: t('Reviewer'), value: 'reviewer' },
  { label: t('Admin'), value: 'admin' },
]

function errMsg(e: unknown, fallback: string) {
  return (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}

// --- Create ---
const form = reactive({ email: '', name: '', password: '', role: 'viewer' as UserRow['role'] })
const creating = ref(false)
async function createUser() {
  creating.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: { email: form.email, name: form.name || null, password: form.password, role: form.role },
    })
    toast.add({ title: t('User created'), icon: 'i-lucide-check', color: 'success' })
    form.email = ''
    form.name = ''
    form.password = ''
    form.role = 'viewer'
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Create failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    creating.value = false
  }
}

// --- Change role inline ---
async function changeRole(u: UserRow, role: UserRow['role']) {
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'PATCH', body: { role } })
    toast.add({ title: t('Role updated'), icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Update failed')), icon: 'i-lucide-circle-alert', color: 'error' })
    await refresh()
  }
}

// --- Delete ---
const confirmDelete = ref<UserRow | null>(null)
const deleting = ref(false)
async function deleteUser() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/users/${confirmDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: t('User deleted'), icon: 'i-lucide-check', color: 'success' })
    confirmDelete.value = null
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e, t('Delete failed')), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    deleting.value = false
  }
}

function fmtTime(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 10) : '—'
}
</script>

<template>
  <div class="mx-auto max-w-4xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('Users') }}</h1>
      <p class="text-muted">{{ $t('Manage accounts and roles.') }}</p>
    </header>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('Add user') }}</h2></template>
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:items-end" @submit.prevent="createUser">
        <UFormField :label="$t('Email')"><UInput v-model="form.email" type="email" /></UFormField>
        <UFormField :label="$t('Name')"><UInput v-model="form.name" /></UFormField>
        <UFormField :label="$t('Password')"><UInput v-model="form.password" type="password" /></UFormField>
        <UFormField :label="$t('Role')"><USelect v-model="form.role" :items="roleItems" /></UFormField>
        <UButton type="submit" :loading="creating" icon="i-lucide-user-plus">{{ $t('Add user') }}</UButton>
      </form>
    </UCard>

    <UCard>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-default text-muted">
            <th class="py-2 pr-4 font-medium">{{ $t('Email') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Name') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Role') }}</th>
            <th class="py-2 pr-4 font-medium">{{ $t('Created') }}</th>
            <th class="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-b border-default/50 last:border-0">
            <td class="py-2 pr-4 font-mono">
              {{ u.email }}
              <UBadge v-if="me && u.id === me.id" color="neutral" variant="subtle" size="sm" class="ml-2">{{ $t('You') }}</UBadge>
            </td>
            <td class="py-2 pr-4">{{ u.name || '—' }}</td>
            <td class="py-2 pr-4">
              <USelect
                :model-value="u.role"
                :items="roleItems"
                size="sm"
                class="w-36"
                @update:model-value="changeRole(u, $event as UserRow['role'])"
              />
            </td>
            <td class="py-2 pr-4 text-muted">{{ fmtTime(u.createdAt) }}</td>
            <td class="py-2 text-right">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="confirmDelete = u"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal :open="!!confirmDelete" :title="$t('Delete user?')" @update:open="(v) => { if (!v) confirmDelete = null }">
      <template #body>
        <p class="text-sm text-muted">{{ $t('This permanently removes {email}.', { email: confirmDelete?.email }) }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmDelete = null">{{ $t('Cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="deleteUser">{{ $t('Delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
