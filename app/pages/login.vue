<script setup lang="ts">
// Standalone login page (M5-A). The global auth middleware routes here when unauthenticated.
definePageMeta({ layout: false })
const { t, locale, locales, setLocale } = useI18n()
const { fetch: refreshSession } = useUserSession()
const router = useRouter()
const toast = useToast()
useHead({ title: () => t('Sign in') })

const localeItems = computed(() =>
  (locales.value as { code: string; name?: string }[]).map((l) => ({ label: l.name ?? l.code, value: l.code })),
)

// Login methods contributed by plugins (e.g. SSO), if licensed.
const { data: providers } = await useFetch<{ id: string; label: string; startPath: string; icon?: string }[]>(
  '/api/auth/providers',
  { default: () => [] },
)

const email = ref('')
const password = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await refreshSession()
    await router.push('/')
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Invalid email or password')
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

    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="flex flex-col items-center gap-3 text-center">
          <AppLogo :size="40" :wordmark="false" />
          <h1 class="text-lg font-bold">{{ $t('Sign in to kvellman') }}</h1>
        </div>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="$t('Email')">
          <UInput v-model="email" type="email" autocomplete="username" autofocus />
        </UFormField>
        <UFormField :label="$t('Password')">
          <UInput v-model="password" type="password" autocomplete="current-password" />
        </UFormField>
        <UButton type="submit" block :loading="loading" icon="i-lucide-log-in">{{ $t('Sign in') }}</UButton>
      </form>

      <template v-if="providers.length">
        <USeparator :label="$t('or')" class="my-4" />
        <div class="space-y-2">
          <UButton
            v-for="p in providers"
            :key="p.id"
            :to="p.startPath"
            external
            block
            color="neutral"
            variant="soft"
            :icon="p.icon || 'i-lucide-shield-check'"
          >
            {{ $t('Sign in with {provider}', { provider: p.label }) }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
