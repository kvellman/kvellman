import { and, eq, sql } from 'drizzle-orm'
import { versionEditSchema } from '#shared/manifest'
import { db } from '../../../../db/client'
import { auditEntries, installers, locales, packages, versions } from '../../../../db/schema'
import { installerView, localeView, toInstallerInsert, toLocaleInsert } from '../../../../utils/manifestRows'

// PUT /api/packages/{id}/versions/{version} — edit a version's installers + locales.
// Editing a pristine 'upstream' version snapshots it and turns it into an 'overlay' (the upstream
// stays recoverable via reset, and the change is shown as a diff). 'overlay'/'local' edit in place.
// packageVersion is the identity and is not changed here.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')

  const parsed = await readValidatedBody(event, (b) => versionEditSchema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid manifest', data: parsed.error.flatten() })
  }
  const body = parsed.data

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true, packageIdentifier: true },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }

  const v = await db.query.versions.findFirst({
    where: and(eq(versions.packageId, pkg.id), eq(versions.packageVersion, version)),
    columns: { id: true, origin: true, manifestVersion: true },
    with: { installers: true, locales: true },
  })
  if (!v) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  // First edit of a pristine upstream version → capture the pristine manifest and become an overlay.
  const becomingOverlay = v.origin === 'upstream'
  const snapshot = becomingOverlay
    ? {
        manifestVersion: v.manifestVersion,
        locales: v.locales.map(localeView),
        installers: v.installers.map(installerView),
      }
    : undefined

  await db.transaction(async (tx) => {
    await tx.delete(installers).where(eq(installers.versionId, v.id))
    await tx.delete(locales).where(eq(locales.versionId, v.id))
    await tx.insert(installers).values(body.installers.map((i) => toInstallerInsert(v.id, i)))
    await tx.insert(locales).values(body.locales.map((l) => toLocaleInsert(v.id, l)))

    // Any edit changes the delivered content → require re-approval (clear prior review).
    await tx
      .update(versions)
      .set({
        approvalStatus: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        ...(becomingOverlay ? { origin: 'overlay' as const, upstreamSnapshot: snapshot } : {}),
      })
      .where(eq(versions.id, v.id))

    await tx.insert(auditEntries).values({
      action: becomingOverlay ? 'manifest.overlay' : 'manifest.edit',
      actor: await getActor(event),
      packageIdentifier: pkg.packageIdentifier,
      packageVersion: version,
    })
  })

  return { ok: true, origin: becomingOverlay ? 'overlay' : v.origin }
})
