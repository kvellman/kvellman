import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import { upstreamCatalog } from '../db/schema'
import { runCatalogSync } from '../utils/runCatalogSync'

// In-process scheduled upstream-catalog sync (Community/single-node) via a simple interval. Opt-in
// via CATALOG_SYNC_ENABLED=true; period via CATALOG_SYNC_INTERVAL_HOURS (default 6). For
// Enterprise/HA this would move to a BullMQ worker, but the sync logic (runCatalogSync) is shared.
export default defineNitroPlugin(() => {
  const cfg = useRuntimeConfig()
  if (!cfg.catalogSyncEnabled) return

  const hours = Math.max(1, Number(cfg.catalogSyncIntervalHours) || 6)

  async function sync(reason: string) {
    try {
      const { count } = await runCatalogSync()
      console.log(`[catalog] synced ${count} packages (${reason})`)
    } catch (e) {
      console.error(`[catalog] sync failed: ${(e as Error).message}`)
    }
  }

  // Reset any previous timer across dev HMR reloads.
  const g = globalThis as unknown as { __kvellmanCatalogTimer?: ReturnType<typeof setInterval> }
  if (g.__kvellmanCatalogTimer) clearInterval(g.__kvellmanCatalogTimer)
  g.__kvellmanCatalogTimer = setInterval(() => void sync('scheduled'), hours * 60 * 60 * 1000)
  g.__kvellmanCatalogTimer.unref?.()
  console.log(`[catalog] auto-sync enabled: every ${hours}h`)

  // Populate a fresh instance once at startup (skips if the catalog is already filled).
  void (async () => {
    try {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(upstreamCatalog)
      if ((row?.count ?? 0) === 0) await sync('initial: catalog empty')
    } catch {
      // DB not ready yet — the next interval will catch up.
    }
  })()
})
