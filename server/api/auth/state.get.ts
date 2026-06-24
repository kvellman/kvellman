import { sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { users } from '../../db/schema'

// GET /api/auth/state — drives the auth UI: whether first-run setup is needed and the current user.
// Public (no session required) so the login/setup pages can decide what to render.
export default defineEventHandler(async (event) => {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(users)
  const session = await getUserSession(event)
  return { needsSetup: (row?.c ?? 0) === 0, user: session?.user ?? null }
})
