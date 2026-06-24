import { z } from 'zod'
import { db } from '../../db/client'
import { users } from '../../db/schema'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional().nullable(),
  password: z.string().min(8, 'At least 8 characters').max(200),
  role: z.enum(['admin', 'reviewer', 'viewer']),
})

// POST /api/users — create an account (admin only; enforced by server middleware).
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { email, name, password, role } = parsed.data

  const passwordHash = await hashPassword(password)
  try {
    const [u] = await db
      .insert(users)
      .values({ email, name: name ?? null, passwordHash, role })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
    setResponseStatus(event, 201)
    return u
  } catch (e) {
    // Unique violation on email (code may be on the error or its Drizzle-wrapped cause).
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code
    if (code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'A user with that email already exists' })
    }
    throw e
  }
})
