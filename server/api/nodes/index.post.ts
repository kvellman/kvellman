import { z } from 'zod'
import { db } from '../../db/client'
import { nodes } from '../../db/schema'
import { generateSecret, hashSecret } from '../../utils/nodeAuth'

const schema = z.object({ name: z.string().trim().min(1).max(120) })

// POST /api/nodes — register a node and return a ONE-TIME enrollment key (admin only; gated by
// middleware). Creating the entry is the approval; the key is shown once and only stored hashed.
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const enrollmentKey = generateSecret()
  const [row] = await db
    .insert(nodes)
    .values({ name: parsed.data.name, status: 'pending', enrollmentKeyHash: hashSecret(enrollmentKey) })
    .returning({ id: nodes.id, name: nodes.name, status: nodes.status })
  setResponseStatus(event, 201)
  return { ...row, enrollmentKey }
})
