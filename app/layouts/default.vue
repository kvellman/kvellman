<script setup lang="ts">
// App shell: header with brand, primary nav, theme toggle and language switcher.
const { locale, locales, setLocale, t } = useI18n()
const colorMode = useColorMode()

const localeItems = computed(() =>
  (locales.value as { code: string; name?: string }[]).map((l) => ({
    label: l.name ?? l.code,
    value: l.code,
  })),
)

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Current user + logout (M5-A) and role-based nav (M5-B).
const { user, clear: clearSession } = useUserSession()
const { isAdmin } = useAuthz()

// Admin-only area grouped into a dropdown.
const adminItems = computed(() => [
  [
    { label: t('Site tokens'), icon: 'i-lucide-key-round', to: '/site-tokens' },
    { label: t('Edge nodes'), icon: 'i-lucide-server', to: '/nodes' },
    { label: t('Audit log'), icon: 'i-lucide-scroll-text', to: '/audit' },
    { label: t('Users'), icon: 'i-lucide-users', to: '/users' },
    { label: t('License'), icon: 'i-lucide-badge-check', to: '/license' },
  ],
])
const router = useRouter()
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await router.push('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default text-default">
    <header class="border-b border-default">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <div class="flex items-center gap-6">
          <ULink to="/" :aria-label="t('Dashboard')">
            <AppLogo :size="26" />
          </ULink>
          <nav class="flex items-center gap-4 text-sm">
            <ULink to="/" active-class="text-default" inactive-class="text-muted hover:text-default">
              {{ t('Dashboard') }}
            </ULink>
            <ULink to="/packages" active-class="text-default" inactive-class="text-muted hover:text-default">
              {{ t('Packages') }}
            </ULink>
            <UDropdownMenu v-if="isAdmin" :items="adminItems">
              <button type="button" class="flex items-center gap-1 text-muted hover:text-default">
                {{ t('Admin') }}
                <UIcon name="i-lucide-chevron-down" class="size-4" />
              </button>
            </UDropdownMenu>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <ClientOnly>
            <UButton
              :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
              color="neutral"
              variant="ghost"
              :aria-label="t('Toggle theme')"
              @click="toggleTheme"
            />
            <template #fallback>
              <div class="size-8" />
            </template>
          </ClientOnly>
          <USelect
            :model-value="locale"
            :items="localeItems"
            icon="i-lucide-languages"
            size="sm"
            class="w-36"
            :aria-label="t('Language')"
            @update:model-value="setLocale($event as 'en' | 'de')"
          />
          <div v-if="user" class="flex items-center gap-2 border-l border-default pl-2">
            <span class="hidden text-sm text-muted sm:inline">{{ user.name || user.email }}</span>
            <UButton
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('Sign out')"
              @click="logout"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm text-muted">
        <span class="flex items-center gap-2">
          <AppLogo :size="18" :wordmark="false" />
          kvellman · {{ $t('Self-hosted winget-compatible repository') }}
        </span>
        <ULink to="/instructions" class="flex items-center gap-1 hover:text-default">
          <UIcon name="i-lucide-book-open" class="size-4" />
          {{ t('Instructions') }}
        </ULink>
      </div>
    </footer>
  </div>
</template>
