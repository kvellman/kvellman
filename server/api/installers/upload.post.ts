import { storeInstaller } from '../../services/storage'

// POST /api/installers/upload — store an installer binary in the local origin store during manifest
// creation/editing (before the installer row exists) and return its localFile path + SHA-256. The
// form puts these on the installer; createManifestVersion / the edit PUT then persist localFile so
// delivery serves the local copy. reviewer+. (Re-hosting an existing installer still uses
// /api/installers/{id}/file.)
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.filename && p.data)
  const field = (n: string) =>
    parts?.find((p) => p.name === n && !p.filename)?.data?.toString('utf8').trim() ?? ''
  const packageIdentifier = field('packageIdentifier')
  const packageVersion = field('packageVersion')

  if (!file?.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }
  if (!packageIdentifier || !packageVersion) {
    throw createError({ statusCode: 400, statusMessage: 'Enter the package identifier and version first' })
  }

  const { relPath, sha256 } = await storeInstaller(
    packageIdentifier,
    packageVersion,
    file.filename ?? 'installer.bin',
    file.data,
  )
  return { localFile: relPath, sha256, filename: file.filename }
})
