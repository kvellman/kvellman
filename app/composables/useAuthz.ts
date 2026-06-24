// Client-side role helpers (M5-B). UX only — the server enforces RBAC; this hides actions a user
// cannot perform. viewer < reviewer < admin.
export function useAuthz() {
  const { user } = useUserSession()
  const role = computed(() => user.value?.role ?? 'viewer')
  const canWrite = computed(() => role.value === 'reviewer' || role.value === 'admin')
  const isAdmin = computed(() => role.value === 'admin')
  return { role, canWrite, isAdmin }
}
