import { runCatalogSync } from '../../utils/runCatalogSync'

// POST /api/upstream/sync — manually refresh the local upstream catalog from the winget index.
// (A scheduled job in server/plugins/catalog-scheduler.ts reuses the same runCatalogSync.)
export default defineEventHandler(async (event) => {
  const { count } = await runCatalogSync((await getActor(event)) ?? 'system')
  return { count, syncedAt: new Date().toISOString() }
})
