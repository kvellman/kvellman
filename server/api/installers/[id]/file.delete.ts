import { eq } from 'drizzle-orm'
import { db } from '../../../db/client'
import { installers } from '../../../db/schema'
import { removeStored } from '../../../services/storage'

// DELETE /api/installers/{id}/file — remove the locally stored binary and clear localFile, so
// delivery reverts to the installer's original installerUrl. (installerSha256 is left as-is.)
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid installer id' })
  }

  const inst = await db.query.installers.findFirst({
    where: eq(installers.id, id),
    columns: { id: true, localFile: true },
  })
  if (!inst) {
    throw createError({ statusCode: 404, statusMessage: 'Installer not found' })
  }
  if (inst.localFile) await removeStored(inst.localFile)
  await db.update(installers).set({ localFile: null }).where(eq(installers.id, id))

  return { ok: true }
})
