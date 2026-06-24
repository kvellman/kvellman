// Named middleware (M5-B): redirect viewers away from write-only pages (create/edit/import).
// The server enforces RBAC regardless; this avoids showing a page the user cannot submit.
export default defineNuxtRouteMiddleware(() => {
  const { canWrite } = useAuthz()
  if (!canWrite.value) return navigateTo('/')
})
