import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { auditEntries, packages, versions } from '../../../../db/schema'
import { installerDir, removeStoredDir } from '../../../../services/storage'

// DELETE /api/packages/{id}/versions/{version} — delete a version (installers/locales cascade) and
// its stored binaries. If it was the package's last version, the (now-empty) package is removed too.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')

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

  await db.delete(versions).where(eq(versions.id, v.id))
  await removeStoredDir(installerDir(pkg.packageIdentifier, version))

  // Remove the package too if no versions remain.
  const remaining = await db.query.versions.findMany({
    where: eq(versions.packageId, pkg.id),
    columns: { id: true },
  })
  let packageDeleted = false
  if (remaining.length === 0) {
    await db.delete(packages).where(eq(packages.id, pkg.id))
    await removeStoredDir(installerDir(pkg.packageIdentifier))
    packageDeleted = true
  }

  await db.insert(auditEntries).values({
    action: 'version.delete',
    actor: await getActor(event),
    packageIdentifier: pkg.packageIdentifier,
    packageVersion: version,
    detail: { packageDeleted },
  })

  return { ok: true, packageDeleted }
})
