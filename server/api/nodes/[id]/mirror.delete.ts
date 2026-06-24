import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client'
import { nodeCacheRemovals, nodeMirrorRequests, nodes } from '../../../db/schema'

// DELETE /api/nodes/{id}/mirror?packageIdentifier=&packageVersion= — admin asks a node to evict a
// mirrored version (free space). Queues a removal the node executes on its next heartbeat, and
// cancels any pending push for the same version. Admin-gated by the /api/nodes middleware.
const schema = z.object({
  packageIdentifier: z.string().trim().min(1),
  packageVersion: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
  const nodeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(nodeId)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const parsed = schema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const { packageIdentifier, packageVersion } = parsed.data

  const node = await db.query.nodes.findFirst({ where: eq(nodes.id, nodeId), columns: { id: true } })
  if (!node) throw createError({ statusCode: 404, statusMessage: 'Node not found' })

  // Cancel any pending push for this version so it is not re-fetched.
  await db
    .delete(nodeMirrorRequests)
    .where(
      and(
        eq(nodeMirrorRequests.nodeId, nodeId),
        eq(nodeMirrorRequests.packageIdentifier, packageIdentifier),
        eq(nodeMirrorRequests.packageVersion, packageVersion),
      ),
    )

  await db
    .insert(nodeCacheRemovals)
    .values({ nodeId, packageIdentifier, packageVersion })
    .onConflictDoNothing()

  return { ok: true }
})
