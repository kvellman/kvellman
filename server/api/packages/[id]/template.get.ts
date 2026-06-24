import { sql } from 'drizzle-orm'
import { db } from '../../../db/client'
import { packages } from '../../../db/schema'

// GET /api/packages/{id}/template — the package's overlay template (rules + source version), or null.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { overlayTemplate: true },
  })
  if (!pkg) throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  return pkg.overlayTemplate ?? { rules: [], sourceVersion: null }
})
