import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../../../db/client'
import { auditEntries, installers, locales, packages, versions } from '../../../../../db/schema'
import { toInstallerInsert, toLocaleInsert } from '../../../../../utils/manifestRows'

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST /api/packages/{id}/versions/{version}/reset — discard an overlay's customizations and
// restore the pristine upstream manifest from its snapshot (origin → 'upstream').
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
    columns: { id: true, origin: true, upstreamSnapshot: true },
  })
  if (!v) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }
  if (v.origin !== 'overlay' || !v.upstreamSnapshot) {
    throw createError({ statusCode: 409, statusMessage: 'This version is not an overlay' })
  }
  const snap = v.upstreamSnapshot

  await db.transaction(async (tx) => {
    await tx.delete(installers).where(eq(installers.versionId, v.id))
    await tx.delete(locales).where(eq(locales.versionId, v.id))
    await tx.insert(installers).values((snap.installers ?? []).map((i: any) => toInstallerInsert(v.id, i)))
    await tx.insert(locales).values((snap.locales ?? []).map((l: any) => toLocaleInsert(v.id, l)))
    await tx
      .update(versions)
      .set({
        origin: 'upstream',
        manifestVersion: snap.manifestVersion,
        upstreamSnapshot: null,
        // Restored content differs from what was approved → require re-approval.
        approvalStatus: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      })
      .where(eq(versions.id, v.id))
    await tx.insert(auditEntries).values({
      action: 'manifest.reset',
      actor: await getActor(event),
      packageIdentifier: pkg.packageIdentifier,
      packageVersion: version,
    })
  })

  return { ok: true }
})
