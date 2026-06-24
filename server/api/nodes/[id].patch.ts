import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { nodes } from '../../db/schema'

// PATCH /api/nodes/{id} — update a node's package scope (admin only; gated by middleware).
const schema = z.object({
  scopeAll: z.boolean().optional(),
  scopePackages: z.array(z.string().trim().min(1)).optional(),
  scopeTags: z.array(z.string().trim().min(1)).optional(),
  filterArchitectures: z.array(z.string().trim().min(1)).optional(),
  filterScopes: z.array(z.string().trim().min(1)).optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const patch = parsed.data
  if (Object.keys(patch).length === 0) return { ok: true }

  const existing = await db.query.nodes.findFirst({ where: eq(nodes.id, id), columns: { id: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Node not found' })

  await db.update(nodes).set(patch).where(eq(nodes.id, id))
  return { ok: true }
})
