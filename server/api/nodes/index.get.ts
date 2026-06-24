import { asc } from 'drizzle-orm'
import { db } from '../../db/client'
import { nodeMirrorRequests, nodes } from '../../db/schema'

// GET /api/nodes — registered edge nodes (admin only; gated by middleware). No secrets.
export default defineEventHandler(async () => {
  const rows = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      status: nodes.status,
      lastSeenAt: nodes.lastSeenAt,
      enrolledAt: nodes.enrolledAt,
      createdAt: nodes.createdAt,
      lastInfo: nodes.lastInfo,
      scopeAll: nodes.scopeAll,
      scopePackages: nodes.scopePackages,
      scopeTags: nodes.scopeTags,
      filterArchitectures: nodes.filterArchitectures,
      filterScopes: nodes.filterScopes,
    })
    .from(nodes)
    .orderBy(asc(nodes.id))

  // Pending push requests (queued, not yet reported as mirrored) per node.
  const reqs = await db
    .select({
      nodeId: nodeMirrorRequests.nodeId,
      packageIdentifier: nodeMirrorRequests.packageIdentifier,
      packageVersion: nodeMirrorRequests.packageVersion,
    })
    .from(nodeMirrorRequests)
  const pendingByNode = new Map<number, { packageIdentifier: string; packageVersion: string }[]>()
  for (const r of reqs) {
    const list = pendingByNode.get(r.nodeId) ?? []
    list.push({ packageIdentifier: r.packageIdentifier, packageVersion: r.packageVersion })
    pendingByNode.set(r.nodeId, list)
  }

  return rows.map((n) => ({ ...n, pending: pendingByNode.get(n.id) ?? [] }))
})
