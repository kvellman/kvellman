import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../../../db/client'
import { auditEntries, packages, versions } from '../../../../../db/schema'

const bodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  note: z.string().trim().max(1000).optional().nullable(),
})

// POST /api/packages/{id}/versions/{version}/approval — set the review state of a version.
// Only 'approved' versions are delivered to winget clients (see the Source API routes). The
// reviewer is a placeholder until real users/RBAC arrive in M5.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')

  const parsed = await readValidatedBody(event, (b) => bodySchema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request', data: parsed.error.flatten() })
  }
  const { status, note } = parsed.data
  const { user } = await requireUserSession(event)
  const reviewer = user.name || user.email

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true, packageIdentifier: true },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }
  const v = await db.query.versions.findFirst({
    where: and(eq(versions.packageId, pkg.id), eq(versions.packageVersion, version)),
    columns: { id: true },
  })
  if (!v) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  const reviewed = status !== 'pending'
  await db.transaction(async (tx) => {
    await tx
      .update(versions)
      .set({
        approvalStatus: status,
        reviewedBy: reviewed ? reviewer : null,
        reviewedAt: reviewed ? new Date() : null,
        reviewNote: reviewed ? (note ?? null) : null,
      })
      .where(eq(versions.id, v.id))
    await tx.insert(auditEntries).values({
      action: `approval.${status}`,
      actor: reviewer,
      packageIdentifier: pkg.packageIdentifier,
      packageVersion: version,
      detail: note ? { note } : undefined,
    })
  })

  return { ok: true, status }
})
