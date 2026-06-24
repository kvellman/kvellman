import { eq } from 'drizzle-orm'
import { db } from '../../../db/client'
import { installers } from '../../../db/schema'
import { storeInstaller } from '../../../services/storage'

// POST /api/installers/{id}/file — upload an installer binary into the local origin store. Computes
// the SHA-256 and sets the installer's localFile + installerSha256. The original installerUrl is
// kept as the source/fallback; delivery serves the local copy whenever localFile is set.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid installer id' })
  }

  const inst = await db.query.installers.findFirst({
    where: eq(installers.id, id),
    with: { version: { with: { package: true } } },
  })
  if (!inst) {
    throw createError({ statusCode: 404, statusMessage: 'Installer not found' })
  }

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.filename && p.data)
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const { relPath, sha256 } = await storeInstaller(
    inst.version.package.packageIdentifier,
    inst.version.packageVersion,
    filePart.filename ?? 'installer.bin',
    filePart.data,
  )
  await db
    .update(installers)
    .set({ localFile: relPath, installerSha256: sha256 })
    .where(eq(installers.id, id))

  return { localFile: relPath, installerSha256: sha256 }
})
