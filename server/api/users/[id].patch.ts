import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { users } from '../../db/schema'

const schema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  role: z.enum(['admin', 'reviewer', 'viewer']).optional(),
  password: z.string().min(8, 'At least 8 characters').max(200).optional(),
})

// PATCH /api/users/{id} — update name/role/password (admin only). Guards against demoting the last
// admin so the instance can never be left without one.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { name, role, password } = parsed.data

  const target = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, role: true } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // Demoting the last remaining admin would lock everyone out.
  if (role && role !== 'admin' && target.role === 'admin') {
    const [others] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, id)))
    if ((others?.c ?? 0) === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot demote the last admin' })
    }
  }

  const patch: Partial<typeof users.$inferInsert> = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role
  if (password !== undefined) patch.passwordHash = await hashPassword(password)
  if (Object.keys(patch).length === 0) return { ok: true }

  await db.update(users).set(patch).where(eq(users.id, id))
  return { ok: true }
})
