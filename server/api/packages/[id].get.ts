import { sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { packages } from '../../db/schema'

// GET /api/packages/{id} — internal UI package overview. Returns the package header and a
// summary of its versions (origin + installer count only). Full per-version manifest detail
// lives at /api/packages/{id}/versions/{version}. This is the admin/management view, distinct
// from the winget delivery endpoint under /api/{siteToken}/packageManifests/{id}.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    with: { versions: { with: { installers: { columns: { id: true } } } } },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }

  return {
    packageIdentifier: pkg.packageIdentifier,
    packageName: pkg.packageName,
    publisher: pkg.publisher,
    moniker: pkg.moniker,
    tags: pkg.tags,
    versions: pkg.versions.map((v) => ({
      packageVersion: v.packageVersion,
      origin: v.origin,
      installerCount: v.installers.length,
      approvalStatus: v.approvalStatus,
    })),
  }
})
