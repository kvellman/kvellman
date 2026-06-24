import { listUpstreamVersions } from '../../services/wingetUpstream'

// GET /api/upstream/versions?id=<PackageIdentifier> — list the versions available in winget-pkgs
// (newest first). Empty list if the package is unknown upstream.
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing package identifier' })
  }
  return { packageIdentifier: id, versions: await listUpstreamVersions(id) }
})
