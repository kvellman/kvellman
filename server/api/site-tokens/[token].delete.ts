import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { siteTokens } from '../../db/schema'
import { requireRole } from '../../utils/authz'

// DELETE /api/site-tokens/{token} — revoke a site token (admin only). Clients still using it fall
// back to the default site context (resolveSite), so delivery keeps working with default settings.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const token = getRouterParam(event, 'token') ?? ''

  const existing = await db.query.siteTokens.findFirst({ where: eq(siteTokens.token, token), columns: { token: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Site token not found' })

  await db.delete(siteTokens).where(eq(siteTokens.token, token))
  return { ok: true }
})
