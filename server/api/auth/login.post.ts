import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { users } from '../../db/schema'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1),
})

// POST /api/auth/login — verify credentials and start a session.
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  const { email, password } = parsed.data

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  // No password hash → external (SSO) account; local password login is not possible. A generic 401
  // avoids user enumeration.
  if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
  return { ok: true }
})
