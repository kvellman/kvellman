import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { packages, versions } from '../../../../db/schema'
import { buildSingletonYaml } from '../../../../utils/manifestYaml'
import { installerView, localeView } from '../../../../utils/manifestRows'
import { checkVersionSpec } from '../../../../utils/specCheck'
import { diffManifest } from '../../../../utils/manifestDiff'

// GET /api/packages/{id}/versions/{version} — full detail of a single stored version:
// the RAW manifest (installers + locales, placeholders unresolved, stored hashes). This is
// the admin/management view, distinct from the winget delivery endpoint.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = decodeURIComponent(getRouterParam(event, 'version') ?? '')

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true, packageIdentifier: true, packageName: true, publisher: true, moniker: true },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }

  const v = await db.query.versions.findFirst({
    where: and(eq(versions.packageId, pkg.id), eq(versions.packageVersion, version)),
    with: { installers: true, locales: true },
  })
  if (!v) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  const installerViews = v.installers.map(installerView)
  const localeViews = v.locales.map(localeView)
  const manifest = {
    packageIdentifier: pkg.packageIdentifier,
    packageVersion: v.packageVersion,
    manifestVersion: v.manifestVersion,
    installers: installerViews,
    locales: localeViews,
  }

  return {
    packageIdentifier: pkg.packageIdentifier,
    packageName: pkg.packageName,
    publisher: pkg.publisher,
    moniker: pkg.moniker,
    packageVersion: v.packageVersion,
    manifestVersion: v.manifestVersion,
    origin: v.origin,
    // Review/approval state (M4-B) — only 'approved' versions reach winget clients.
    approval: {
      status: v.approvalStatus,
      reviewedBy: v.reviewedBy,
      reviewedAt: v.reviewedAt,
      note: v.reviewNote,
    },
    // All versions are editable; editing an upstream version creates an overlay.
    editable: true,
    // For overlays: field-level diff of the pristine upstream snapshot vs the effective manifest.
    overlayDiff:
      v.origin === 'overlay' && v.upstreamSnapshot
        ? diffManifest(v.upstreamSnapshot, { manifestVersion: v.manifestVersion, locales: localeViews, installers: installerViews })
        : [],
    rawYaml: buildSingletonYaml(manifest),
    // Automatic spec-compatibility check against the declared ManifestVersion's schema.
    specCheck: await checkVersionSpec(manifest),
    installers: installerViews,
    locales: localeViews,
  }
})
