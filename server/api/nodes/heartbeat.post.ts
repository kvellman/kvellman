import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { nodeCacheRemovals, nodeMirrorRequests, nodes } from '../../db/schema'
import { requireNode } from '../../utils/nodeAuth'

// POST /api/nodes/heartbeat — a node reports it is alive (Bearer node-token). Updates lastSeenAt and
// optional info. Also drives mirror pushes: clears requests the node now reports as mirrored and
// returns the still-pending ones (with resolved URLs) for the node to pre-fetch. Public route
// (exempt from session middleware); authenticated via the node token.
interface Mirrored {
  packageIdentifier: string
  packageVersion: string
}

export default defineEventHandler(async (event) => {
  const node = await requireNode(event)
  const body = (await readBody(event).catch(() => ({}))) as { info?: Record<string, unknown> }
  await db
    .update(nodes)
    .set({ lastSeenAt: new Date(), lastInfo: body?.info ?? node.lastInfo })
    .where(eq(nodes.id, node.id))

  // Clear mirror requests the node now reports as cached.
  const mirrored = Array.isArray((body?.info as { mirrored?: Mirrored[] })?.mirrored)
    ? (body!.info as { mirrored: Mirrored[] }).mirrored
    : []
  for (const m of mirrored) {
    if (!m?.packageIdentifier || !m?.packageVersion) continue
    await db
      .delete(nodeMirrorRequests)
      .where(
        and(
          eq(nodeMirrorRequests.nodeId, node.id),
          eq(nodeMirrorRequests.packageIdentifier, m.packageIdentifier),
          eq(nodeMirrorRequests.packageVersion, m.packageVersion),
        ),
      )
  }

  // Outstanding push requests for this node → the node pre-fetches their installer URLs.
  const pending = await db.query.nodeMirrorRequests.findMany({
    where: eq(nodeMirrorRequests.nodeId, node.id),
    columns: { packageIdentifier: true, packageVersion: true, urls: true },
  })

  // Removal requests: return those still present in the cache; drop ones the node already evicted.
  const mirroredKeys = new Set(mirrored.map((m) => `${m.packageIdentifier}@${m.packageVersion}`))
  const removals = await db.query.nodeCacheRemovals.findMany({
    where: eq(nodeCacheRemovals.nodeId, node.id),
    columns: { packageIdentifier: true, packageVersion: true },
  })
  const remove = removals.filter((r) => mirroredKeys.has(`${r.packageIdentifier}@${r.packageVersion}`))
  for (const r of removals) {
    if (!mirroredKeys.has(`${r.packageIdentifier}@${r.packageVersion}`)) {
      await db
        .delete(nodeCacheRemovals)
        .where(
          and(
            eq(nodeCacheRemovals.nodeId, node.id),
            eq(nodeCacheRemovals.packageIdentifier, r.packageIdentifier),
            eq(nodeCacheRemovals.packageVersion, r.packageVersion),
          ),
        )
    }
  }

  return {
    ok: true,
    status: node.status,
    mirror: pending,
    remove,
    // Installer filter for lazy caching (push is pre-filtered server-side).
    filter: { architectures: node.filterArchitectures, scopes: node.filterScopes },
  }
})
