import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client'
import { packages } from '../../../db/schema'

// PUT /api/packages/{id}/template — replace the overlay template (edit values, or clear with []).
// Reviewer+ (gated by middleware).
const schema = z.object({
  sourceVersion: z.string().nullable().optional(),
  rules: z.array(
    z.object({
      architecture: z.string().trim().min(1),
      field: z.string().trim().min(1),
      value: z.unknown(),
    }),
  ),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true },
  })
  if (!pkg) throw createError({ statusCode: 404, statusMessage: 'Package not found' })

  const template = parsed.data.rules.length
    ? { sourceVersion: parsed.data.sourceVersion ?? undefined, rules: parsed.data.rules }
    : null
  await db.update(packages).set({ overlayTemplate: template }).where(eq(packages.id, pkg.id))
  return template ?? { rules: [], sourceVersion: null }
})
