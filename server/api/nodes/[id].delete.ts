import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { nodes } from '../../db/schema'

// DELETE /api/nodes/{id} — revoke a node (admin only; gated by middleware). Removes the entry, so
// its token stops authenticating immediately.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const existing = await db.query.nodes.findFirst({ where: eq(nodes.id, id), columns: { id: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Node not found' })

  await db.delete(nodes).where(eq(nodes.id, id))
  return { ok: true }
})
