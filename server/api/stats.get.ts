import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { auditEntries, installers, packages, upstreamCatalog, versions } from '../db/schema'

// GET /api/stats — dashboard aggregates over the data we already have (packages, versions by
// origin, installers incl. locally-hosted, catalog size + last sync, recent audit activity).
// Client telemetry (downloads/installs) is M3-next and will add its own panels.
export default defineEventHandler(async () => {
  const [pkgCount] = await db.select({ c: sql<number>`count(*)::int` }).from(packages)
  const originRows = await db
    .select({ origin: versions.origin, c: sql<number>`count(*)::int` })
    .from(versions)
    .groupBy(versions.origin)
  const [inst] = await db
    .select({
      total: sql<number>`count(*)::int`,
      hosted: sql<number>`coalesce(sum(case when ${installers.localFile} is not null then 1 else 0 end), 0)::int`,
    })
    .from(installers)
  const [cat] = await db.select({ c: sql<number>`count(*)::int` }).from(upstreamCatalog)
  const lastSync = await db.query.auditEntries.findFirst({
    where: eq(auditEntries.action, 'catalog.sync'),
    orderBy: (a, { desc }) => desc(a.createdAt),
    columns: { createdAt: true },
  })
  const recent = await db.query.auditEntries.findMany({
    orderBy: (a, { desc }) => desc(a.createdAt),
    limit: 10,
    columns: { action: true, actor: true, packageIdentifier: true, packageVersion: true, createdAt: true },
  })

  const versionsByOrigin: Record<string, number> = {}
  let versionTotal = 0
  for (const r of originRows) {
    versionsByOrigin[r.origin] = r.c
    versionTotal += r.c
  }

  return {
    packages: pkgCount?.c ?? 0,
    versions: { total: versionTotal, byOrigin: versionsByOrigin },
    installers: { total: inst?.total ?? 0, hosted: inst?.hosted ?? 0 },
    catalog: { count: cat?.c ?? 0, syncedAt: lastSync?.createdAt ?? null },
    recent,
  }
})
