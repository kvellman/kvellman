import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { auditEntries, upstreamCatalog } from '../../db/schema'

// GET /api/upstream/catalog-status — catalog size + last sync time (for the import UI).
export default defineEventHandler(async () => {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(upstreamCatalog)
  const last = await db.query.auditEntries.findFirst({
    where: eq(auditEntries.action, 'catalog.sync'),
    orderBy: (a, { desc }) => desc(a.createdAt),
    columns: { createdAt: true },
  })
  const cfg = useRuntimeConfig()
  return {
    count: row?.count ?? 0,
    syncedAt: last?.createdAt ?? null,
    auto: { enabled: !!cfg.catalogSyncEnabled, intervalHours: Number(cfg.catalogSyncIntervalHours) || 6 },
  }
})

