import { maxWingetVersion } from '@kvellman/winget-contract'
import { db } from '../db/client'

// GET /api/packages — internal UI data endpoint (distinct from the winget Source API
// under /api/{siteToken}/...). Lists all packages with their version count.
export default defineEventHandler(async () => {
  const rows = await db.query.packages.findMany({
    with: { versions: { columns: { packageVersion: true } } },
  })

  return rows.map((p) => ({
    packageIdentifier: p.packageIdentifier,
    packageName: p.packageName,
    publisher: p.publisher,
    moniker: p.moniker,
    tags: p.tags,
    versionCount: p.versions.length,
    // Highest version by winget ordering (not insertion order).
    latestVersion: maxWingetVersion(p.versions.map((v) => v.packageVersion)),
  }))
})
