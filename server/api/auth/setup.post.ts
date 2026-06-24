import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { users } from '../../db/schema'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional().nullable(),
  password: z.string().min(8, 'At least 8 characters').max(200),
})

// POST /api/auth/setup — create the first admin (first-run only). Refused once any user exists.
export default defineEventHandler(async (event) => {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(users)
  if ((row?.c ?? 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Setup already completed' })
  }

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { email, name, password } = parsed.data

  const passwordHash = await hashPassword(password)
  const [u] = await db
    .insert(users)
    .values({ email, name: name ?? null, passwordHash, role: 'admin' })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role })

  await setUserSession(event, { user: u! })
  setResponseStatus(event, 201)
  return { ok: true, user: u }
})
