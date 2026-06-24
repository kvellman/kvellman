import { z } from 'zod'
import { requireRole } from '../utils/authz'
import { setLicenseToken } from '../utils/license'

const schema = z.object({ token: z.string().min(1) })

// PUT /api/license — install a license token (verified before storing; admin only).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  return setLicenseToken(parsed.data.token)
})
