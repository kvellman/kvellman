import { asc } from 'drizzle-orm'
import { db } from '../../db/client'
import { users } from '../../db/schema'

// GET /api/users — list accounts (admin only; enforced by server middleware). No password hashes.
export default defineEventHandler(async () => {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.id))
})
