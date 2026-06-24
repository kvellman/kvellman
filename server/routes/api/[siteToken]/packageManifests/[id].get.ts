import { sql } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { packages } from '../../../../db/schema'
import { resolveSite } from '../../../../services/sites'
import { resolveInstaller } from '../../../../utils/resolve'
import { buildLocaleDoc } from '../../../../utils/manifestYaml'
import { recordTelemetry } from '../../../../utils/telemetry'

// GET /api/{siteToken}/packageManifests/{id}[?Version=...]
// Full manifest delivery with site-aware variable resolution + re-hash.
export default defineEventHandler(async (event) => {
  const siteToken = getRouterParam(event, 'siteToken') ?? ''
  const id = getRouterParam(event, 'id') ?? ''
  const ctx = await resolveSite(siteToken)
  const origin = getRequestURL(event).origin
  const query = getQuery(event)
  const wantVersion = typeof query.Version === 'string' ? query.Version : undefined

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    with: { versions: { with: { installers: true, locales: true } } },
  })
  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }

  // Approval gate: only approved versions are delivered to winget clients (M4-B).
  const approved = pkg.versions.filter((v) => v.approvalStatus === 'approved')
  const vers = wantVersion
    ? approved.filter((v) => v.packageVersion === wantVersion)
    : approved
  if (vers.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  const lang = ctx.defaultLocale

  // Usage telemetry: winget fetched this manifest — the strongest install-intent signal we get.
  // One event per delivered version (no-op unless TELEMETRY_ENABLED).
  for (const v of vers) {
    recordTelemetry(event, {
      eventType: 'manifest.fetch',
      packageIdentifier: pkg.packageIdentifier,
      packageVersion: v.packageVersion,
      site: ctx.site,
    })
  }

  return {
    Data: {
      PackageIdentifier: pkg.packageIdentifier,
      Versions: await Promise.all(
        vers.map(async (v) => {
          const def = v.locales.find((l) => l.isDefault) ?? v.locales[0]
          const nonDefault = v.locales.filter((l) => l !== def)
          return {
            PackageVersion: v.packageVersion,
            Channel: '',
            // Full DefaultLocale + additional Locales (spec fidelity).
            DefaultLocale: def ? buildLocaleDoc(def as unknown as Record<string, unknown>) : undefined,
            Locales: nonDefault.map((l) => buildLocaleDoc(l as unknown as Record<string, unknown>)),
            // Resolve placeholders + re-hash per site context.
            Installers: await Promise.all(
              v.installers.map((inst) => resolveInstaller(inst, ctx, lang, origin)),
            ),
          }
        }),
      ),
    },
    ContinuationToken: null,
  }
})
