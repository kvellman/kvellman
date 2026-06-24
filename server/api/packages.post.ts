import { manifestCreateSchema } from '#shared/manifest'
import { createManifestVersion } from '../utils/createManifestVersion'

// POST /api/packages — create a new manifest version from a structured payload (form submit or
// reviewed import). Always origin='local'; 409 if that exact version already exists.
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => manifestCreateSchema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid manifest', data: parsed.error.flatten() })
  }

  const result = await createManifestVersion(parsed.data, {
    origin: 'local',
    action: 'manifest.create',
    actor: await getActor(event),
  })
  setResponseStatus(event, 201)
  return result
})
