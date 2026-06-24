import { ManifestParseError, parseManifest } from '../../utils/manifestParse'

// POST /api/manifests/parse — validate uploaded/pasted manifest(s) WITHOUT persisting, and
// return the structured create payload for the UI to review. Accepts either multipart file
// upload (one or more .yaml files) or a JSON body { text } with one or more YAML documents.
export default defineEventHandler(async (event) => {
  const sources: string[] = []
  const contentType = getHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    for (const p of parts ?? []) {
      if (!p.data) continue
      if (p.filename || p.name === 'text') sources.push(p.data.toString('utf8'))
    }
  } else {
    const body = await readBody<{ text?: string }>(event)
    if (body?.text) sources.push(body.text)
  }

  if (sources.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No manifest content provided' })
  }

  try {
    return { payload: await parseManifest(sources) }
  } catch (e) {
    if (e instanceof ManifestParseError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Manifest validation failed',
        data: { errors: e.errors },
      })
    }
    throw e
  }
})
