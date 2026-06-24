import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { siteTokens } from '../../db/schema'
import { requireRole } from '../../utils/authz'

// PATCH /api/site-tokens/{token} — update a site token's context (admin only). The token value
// itself is the identity and is not editable here (delete + recreate to rename).
const schema = z.object({
  site: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  defaultLocale: z.string().trim().min(2).max(20).optional(),
  repoUrl: z.string().trim().min(1).max(2048).optional(),
  mirrorLocally: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const token = getRouterParam(event, 'token') ?? ''

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const patch = parsed.data
  if (Object.keys(patch).length === 0) return { ok: true }

  const existing = await db.query.siteTokens.findFirst({ where: eq(siteTokens.token, token), columns: { token: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Site token not found' })

  await db.update(siteTokens).set(patch).where(eq(siteTokens.token, token))
  return { ok: true }
})
