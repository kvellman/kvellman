import type { H3Event } from 'h3'

// Role-based access control (M5-B). Hierarchy: viewer < reviewer < admin.
//  - viewer:   read-only
//  - reviewer: content work (create/edit/import/sync) + approve/reject
//  - admin:    everything, incl. user management
export type Role = 'admin' | 'reviewer' | 'viewer'

export const ROLES: Role[] = ['viewer', 'reviewer', 'admin']
export const ROLE_RANK: Record<Role, number> = { viewer: 0, reviewer: 1, admin: 2 }

export function hasRole(role: string | undefined, min: Role): boolean {
  return ROLE_RANK[(role as Role) ?? 'viewer'] >= ROLE_RANK[min]
}

// Require an authenticated user holding at least `min`. Returns the session user.
export async function requireRole(event: H3Event, min: Role) {
  const { user } = await requireUserSession(event)
  if (!hasRole(user.role, min)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }
  return user
}

// Audit actor label for the current request: the signed-in user's name/email, or null.
export async function getActor(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  return session?.user ? session.user.name || session.user.email : null
}
