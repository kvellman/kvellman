import { ilike, or } from 'drizzle-orm'
import { db } from '../../db/client'
import { upstreamCatalog } from '../../db/schema'

// GET /api/upstream/search?q=<term> — substring search over the synced upstream catalog.
export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim()
  if (!q) return { results: [] }
  const like = `%${q}%`
  const results = await db
    .select()
    .from(upstreamCatalog)
    .where(
      or(
        ilike(upstreamCatalog.packageIdentifier, like),
        ilike(upstreamCatalog.name, like),
        ilike(upstreamCatalog.moniker, like),
      ),
    )
    .orderBy(upstreamCatalog.name)
    .limit(25)
  return { results }
})
