import { requireRole } from '../utils/authz'
import { getLicenseStatus } from '../utils/license'

// GET /api/license — current Enterprise license status + active entitlements (admin only).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  return getLicenseStatus()
})
