<script setup lang="ts">
// First-run setup (M5-A): create the initial admin account. Reachable only while no user exists
// (enforced server-side and by the global auth middleware).
definePageMeta({ layout: false })
const { t, locale, locales, setLocale } = useI18n()
const { fetch: refreshSession } = useUserSession()
const router = useRouter()
const toast = useToast()
useHead({ title: () => t('Setup') })

const localeItems = computed(() =>
  (locales.value as { code: string; name?: string }[]).map((l) => ({ label: l.name ?? l.code, value: l.code })),
)

const email = ref('')
const name = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)

// Only flag a mismatch once the user has typed into the confirmation field.
const mismatch = computed(() => passwordConfirm.value.length > 0 && password.value !== passwordConfirm.value)
const canSubmit = computed(
  () => email.value.trim() && password.value.length >= 8 && password.value === passwordConfirm.value,
)

async function submit() {
  if (password.value !== passwordConfirm.value) {
    toast.add({ title: t('Passwords do not match'), icon: 'i-lucide-circle-alert', color: 'error' })
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { email: email.value, name: name.value || null, password: password.value },
    })
    await refreshSession()
    await router.push('/')
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Setup failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-default p-6">
    <USelect
      :model-value="locale"
      :items="localeItems"
      icon="i-lucide-languages"
      size="sm"
      class="absolute right-4 top-4 w-36"
      :aria-label="t('Language')"
      @update:model-value="setLocale($event as 'en' | 'de')"
    />

    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex flex-col items-center gap-3 text-center">
          <AppLogo :size="40" :wordmark="false" />
          <div class="space-y-1">
            <h1 class="text-lg font-bold">{{ $t('Welcome to kvellman') }}</h1>
            <p class="text-sm text-muted">{{ $t('Create the first administrator account.') }}</p>
          </div>
        </div>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="$t('Email')">
          <UInput v-model="email" type="email" autocomplete="username" autofocus />
        </UFormField>
        <UFormField :label="$t('Name')" :hint="$t('Optional')">
          <UInput v-model="name" autocomplete="name" />
        </UFormField>
        <UFormField :label="$t('Password')" :hint="$t('At least 8 characters')">
          <UInput v-model="password" type="password" autocomplete="new-password" />
        </UFormField>
        <UFormField
          :label="$t('Repeat password')"
          :error="mismatch ? $t('Passwords do not match') : undefined"
        >
          <UInput v-model="passwordConfirm" type="password" autocomplete="new-password" />
        </UFormField>
        <UButton type="submit" block :loading="loading" :disabled="!canSubmit" icon="i-lucide-user-plus">
          {{ $t('Create account') }}
        </UButton>
      </form>
    </UCard>
  </div>
</template>
