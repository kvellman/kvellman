import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'

// Helpers auth plugins use to turn an external identity into a kvellman session. Exposed to plugins
// via @kvellman/plugin-sdk (typed) and Nitro auto-imports (at runtime).

export interface SessionUser {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'reviewer' | 'viewer'
}

// Find a user by email, or create an external (passwordless) one. New SSO users default to viewer;
// an admin can promote them.
export async function findOrCreateUser(email: string, opts?: { name?: string | null }): Promise<SessionUser> {
  const e = email.trim().toLowerCase()
  const existing = await db.query.users.findFirst({ where: eq(users.email, e) })
  if (existing) return existing
  const [row] = await db
    .insert(users)
    .values({ email: e, name: opts?.name ?? null, passwordHash: null, role: 'viewer' })
    .returning()
  return row!
}

// Start an authenticated session for a user (wraps nuxt-auth-utils).
export async function startUserSession(event: H3Event, user: SessionUser): Promise<void> {
  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
