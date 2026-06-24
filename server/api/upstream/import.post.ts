import { z } from 'zod'
import { manifestCreateSchema } from '#shared/manifest'
import { createManifestVersion } from '../../utils/createManifestVersion'
import { ManifestParseError, parseManifest } from '../../utils/manifestParse'
import { fetchUpstreamManifest } from '../../services/wingetUpstream'

const bodySchema = z.object({
  packageIdentifier: z.string().trim().min(1),
  version: z.string().trim().min(1),
})

// POST /api/upstream/import — fetch a package version's manifest from winget-pkgs, validate it
// through the normal pipeline, and store it as origin='upstream'. 409 if it already exists locally.
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => bodySchema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request', data: parsed.error.flatten() })
  }
  const { packageIdentifier, version } = parsed.data

  // Network fetch (throws 404/502 on missing/unreachable upstream).
  const files = await fetchUpstreamManifest(packageIdentifier, version)

  // Parse + validate the upstream manifest through the same pipeline as uploads.
  let payload
  try {
    payload = await parseManifest(files)
  } catch (e) {
    if (e instanceof ManifestParseError) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Upstream manifest failed validation',
        data: { errors: e.errors },
      })
    }
    throw e
  }
  const checked = manifestCreateSchema.safeParse(payload)
  if (!checked.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Upstream manifest failed validation',
      data: { errors: checked.error.flatten() },
    })
  }

  const result = await createManifestVersion(checked.data, {
    origin: 'upstream',
    action: 'manifest.import',
    actor: await getActor(event),
  })
  setResponseStatus(event, 201)
  return result
})
