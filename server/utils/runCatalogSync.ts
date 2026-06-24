import { db } from '../db/client'
import { auditEntries, upstreamCatalog } from '../db/schema'
import { fetchUpstreamCatalog } from '../services/catalogSync'

// Fetch the winget index and replace the local catalog (shared by the manual sync endpoint and the
// scheduled job). Returns the number of catalog rows.
export async function runCatalogSync(actor: string = 'system'): Promise<{ count: number }> {
  const rows = await fetchUpstreamCatalog()
  await db.transaction(async (tx) => {
    await tx.delete(upstreamCatalog)
    const CHUNK = 1000
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.insert(upstreamCatalog).values(rows.slice(i, i + CHUNK)).onConflictDoNothing()
    }
    await tx.insert(auditEntries).values({ action: 'catalog.sync', actor, detail: { count: rows.length } })
  })
  return { count: rows.length }
}
