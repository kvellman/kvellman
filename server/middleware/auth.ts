import { hasRole } from '../utils/authz'

// Auth gate for the internal admin API (M5-A). The winget Source API and the installer download
// route are deliberately public — winget clients authenticate via the site token in the URL, never
// a login session. Pages are gated separately by the global route middleware.
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return // pages, /dl, assets
  if (path.startsWith('/api/auth/')) return // login/logout/setup/state
  if (path.startsWith('/api/_')) return // nuxt-auth-utils + nuxt internals
  // winget Source API: /api/{siteToken}/information|manifestSearch|packageManifests — stays public.
  if (/^\/api\/[^/]+\/(information|manifestSearch|packageManifests)(\/|$)/.test(path)) return
  // Edge-node self-authenticated / public endpoints (key/cert/bearer, not a user session).
  if (
    path === '/api/nodes/enroll' ||
    path === '/api/nodes/heartbeat' ||
    path === '/api/nodes/ca' ||
    path === '/api/nodes/sync'
  ) {
    return
  }

  // Everything else under /api is the internal management API → require a session, then apply RBAC:
  //  - user & node management (/api/users, /api/nodes): admin only (all methods)
  //  - reads (GET/HEAD): any authenticated user (viewer+)
  //  - mutations: reviewer+ (content work and approvals)
  const { user } = await requireUserSession(event)
  if (path.startsWith('/api/users') || path.startsWith('/api/nodes')) {
    if (!hasRole(user.role, 'admin')) throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
    return
  }
  const method = event.method
  if (method === 'GET' || method === 'HEAD') return
  if (!hasRole(user.role, 'reviewer')) throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
})
