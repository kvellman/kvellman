import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db/client'
import { siteTokens } from '../db/schema'
import { requireRole } from '../utils/authz'

const schema = z.object({
  // Optional human-friendly slug; auto-generated when omitted.
  token: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Lowercase letters, digits and dashes')
    .optional()
    .or(z.literal('')),
  site: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(120),
  defaultLocale: z.string().trim().min(2).max(20).default('en-US'),
  repoUrl: z.string().trim().min(1).max(2048),
  mirrorLocally: z.boolean().default(false),
})

// POST /api/site-tokens — create a site token (admin only). Site-token management is Community-level;
// scoping, subnet/mTLS resolution and multi-tenancy remain Enterprise.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { token, site, location, defaultLocale, repoUrl, mirrorLocally } = parsed.data
  const value = token && token.length ? token : `t-${randomBytes(4).toString('hex')}`

  try {
    const [row] = await db
      .insert(siteTokens)
      .values({ token: value, site, location, defaultLocale, repoUrl, mirrorLocally })
      .returning()
    setResponseStatus(event, 201)
    return row
  } catch (e) {
    // Drizzle wraps the driver error; the unique-violation code can be on the error or its cause.
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code
    if (code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'That token already exists' })
    }
    throw e
  }
})
