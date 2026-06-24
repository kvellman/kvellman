import { requireRole } from '../utils/authz'
import { clearLicense } from '../utils/license'

// DELETE /api/license — remove the installed license (admin only).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  await clearLicense()
  return { ok: true }
})
