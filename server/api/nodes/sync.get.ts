import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { nodes } from '../../db/schema'
import { requireNode } from '../../utils/nodeAuth'

// GET /api/nodes/sync — the package index an edge node mirrors for its local (offline) search:
// every package that has at least one approved version, with its searchable fields and the list of
// approved versions. Node-authenticated (mTLS cert or bearer); refreshes lastSeen. Per-node package
// scoping can be layered on later.
export default defineEventHandler(async (event) => {
  const node = await requireNode(event)
  await db.update(nodes).set({ lastSeenAt: new Date() }).where(eq(nodes.id, node.id))

  const pkgs = await db.query.packages.findMany({
    with: { versions: { columns: { packageVersion: true, approvalStatus: true } } },
  })

  // Per-node scope: all approved packages, or the union of selected identifiers + matching tags.
  const scopeTags = new Set(node.scopeTags)
  const scopeIds = new Set(node.scopePackages)
  const inScope = (p: (typeof pkgs)[number]) =>
    node.scopeAll || scopeIds.has(p.packageIdentifier) || p.tags.some((t) => scopeTags.has(t))

  const packages = pkgs
    .filter(inScope)
    .map((p) => {
      const versions = p.versions.filter((v) => v.approvalStatus === 'approved').map((v) => v.packageVersion)
      return versions.length
        ? {
            packageIdentifier: p.packageIdentifier,
            packageName: p.packageName,
            publisher: p.publisher,
            moniker: p.moniker,
            tags: p.tags,
            versions,
          }
        : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return { syncedAt: new Date().toISOString(), packages }
})
