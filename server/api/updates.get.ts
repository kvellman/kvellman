import { detectUpdates } from '../services/updates'

// GET /api/updates — packages with a newer version available upstream (via the synced catalog).
export default defineEventHandler(async () => {
  const updates = await detectUpdates()
  return { count: updates.length, updates }
})
