import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { auditEntries, packages } from '../../db/schema'
import { installerDir, removeStoredDir } from '../../services/storage'

// DELETE /api/packages/{id} — delete a package and all its versions/installers/locales (FK cascade)
// plus any stored installer binaries.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true, packageIdentifier: true },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }

  await db.delete(packages).where(eq(packages.id, pkg.id))
  await removeStoredDir(installerDir(pkg.packageIdentifier))
  await db.insert(auditEntries).values({
    action: 'package.delete',
    actor: await getActor(event),
    packageIdentifier: pkg.packageIdentifier,
  })

  return { ok: true }
})
