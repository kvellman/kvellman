// Page-level auth gate (M5-A): redirect to first-run /setup when no account exists, otherwise to
// /login until authenticated. /login and /setup render standalone (no nav).
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  const { needsSetup } = await $fetch('/api/auth/state')

  if (needsSetup) {
    return to.path === '/setup' ? undefined : navigateTo('/setup')
  }
  // Setup is done — /setup is no longer reachable.
  if (to.path === '/setup') return navigateTo(loggedIn.value ? '/' : '/login')

  if (loggedIn.value) {
    return to.path === '/login' ? navigateTo('/') : undefined
  }
  // Not authenticated.
  return to.path === '/login' ? undefined : navigateTo('/login')
})
