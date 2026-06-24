import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client'
import { packages, versions } from '../../../db/schema'
import { installerView } from '../../../utils/manifestRows'
import { deriveTemplateRules } from '../../../utils/overlayTemplate'

// POST /api/packages/{id}/template — derive the package's overlay template from an overlaid version
// (the installer fields it changed vs upstream, generalized with $VERSION/$ARCH). Reviewer+ (gated).
const schema = z.object({ fromVersion: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${id})`,
    columns: { id: true },
  })
  if (!pkg) throw createError({ statusCode: 404, statusMessage: 'Package not found' })

  const v = await db.query.versions.findFirst({
    where: and(eq(versions.packageId, pkg.id), eq(versions.packageVersion, parsed.data.fromVersion)),
    columns: { origin: true, packageVersion: true, upstreamSnapshot: true },
    with: { installers: true },
  })
  if (!v) throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  if (v.origin !== 'overlay' || !v.upstreamSnapshot) {
    throw createError({ statusCode: 400, statusMessage: 'Only an overlaid version can seed a template' })
  }

  const snapshotInstallers = (v.upstreamSnapshot as { installers?: Record<string, unknown>[] }).installers ?? []
  const rules = deriveTemplateRules(
    v.installers.map(installerView) as Record<string, unknown>[],
    snapshotInstallers,
    v.packageVersion,
  )
  const template = { sourceVersion: v.packageVersion, rules }
  await db.update(packages).set({ overlayTemplate: template }).where(eq(packages.id, pkg.id))
  return template
})
