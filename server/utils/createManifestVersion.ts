import { and, eq, sql } from 'drizzle-orm'
import type { ManifestCreateInput } from '#shared/manifest'
import { db } from '../db/client'
import { auditEntries, installers, locales, packages, versions } from '../db/schema'
import { toInstallerInsert, toLocaleInsert } from './manifestRows'

// Shared create path for a new manifest version — used by the form/create endpoint (origin='local')
// and by the winget-pkgs import (origin='upstream'). Upserts the package, rejects a duplicate
// version (409), inserts installers/locales, and writes an audit entry.
export async function createManifestVersion(
  body: ManifestCreateInput,
  opts: { origin: 'local' | 'upstream'; action: string; actor?: string | null },
): Promise<{ packageIdentifier: string; packageVersion: string }> {
  const def = body.locales.find((l) => l.isDefault) ?? body.locales[0]
  if (!def) {
    throw createError({ statusCode: 400, statusMessage: 'At least one locale is required' })
  }

  return db.transaction(async (tx) => {
    let packageId: number
    const existingPkg = await tx.query.packages.findFirst({
      where: sql`lower(${packages.packageIdentifier}) = lower(${body.packageIdentifier})`,
      columns: { id: true },
    })
    if (existingPkg) {
      packageId = existingPkg.id
    } else {
      const [row] = await tx
        .insert(packages)
        .values({
          packageIdentifier: body.packageIdentifier,
          // The default locale guarantees these (localeSchema superRefine), so they are non-null here.
          packageName: def.packageName!,
          publisher: def.publisher!,
          moniker: def.moniker ?? null,
          tags: def.tags,
        })
        .returning({ id: packages.id })
      packageId = row!.id
    }

    const existingVersion = await tx.query.versions.findFirst({
      where: and(eq(versions.packageId, packageId), eq(versions.packageVersion, body.packageVersion)),
      columns: { id: true },
    })
    if (existingVersion) {
      throw createError({
        statusCode: 409,
        statusMessage: `Version ${body.packageVersion} already exists for ${body.packageIdentifier}`,
      })
    }

    const [v] = await tx
      .insert(versions)
      .values({
        packageId,
        packageVersion: body.packageVersion,
        origin: opts.origin,
        manifestVersion: body.manifestVersion,
      })
      .returning({ id: versions.id })
    const versionId = v!.id

    await tx.insert(installers).values(body.installers.map((i) => toInstallerInsert(versionId, i)))
    await tx.insert(locales).values(body.locales.map((l) => toLocaleInsert(versionId, l)))
    await tx.insert(auditEntries).values({
      action: opts.action,
      actor: opts.actor ?? null,
      packageIdentifier: body.packageIdentifier,
      packageVersion: body.packageVersion,
      detail: { installers: body.installers.length, locales: body.locales.length },
    })

    return { packageIdentifier: body.packageIdentifier, packageVersion: body.packageVersion }
  })
}
