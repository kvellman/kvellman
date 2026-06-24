import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { users } from '../../db/schema'

// DELETE /api/users/{id} — remove an account (admin only). Refuses to delete the last admin.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const target = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, role: true } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  if (target.role === 'admin') {
    const [others] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, id)))
    if ((others?.c ?? 0) === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last admin' })
    }
  }

  await db.delete(users).where(eq(users.id, id))
  return { ok: true }
})
