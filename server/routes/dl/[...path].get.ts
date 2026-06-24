import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { resolveStored } from '../../services/storage'
import { recordInstallerDownload } from '../../utils/telemetry'

// GET /dl/<path> — stream a stored installer binary from the local origin store. This is the URL
// the winget client downloads from for locally-hosted installers (see resolveInstaller). Public
// in M1/Community; token-scoping can be layered on later.
export default defineEventHandler(async (event) => {
  const rel = decodeURIComponent(String(getRouterParam(event, 'path') ?? ''))
  if (!rel) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const abs = resolveStored(rel) // throws 400 on traversal outside the store root
  let info
  try {
    info = await stat(abs)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }
  if (!info.isFile()) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  // Usage telemetry: a real installer download from our store (no-op unless TELEMETRY_ENABLED).
  recordInstallerDownload(event, rel)

  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Length', info.size)
  setHeader(event, 'Content-Disposition', `attachment; filename="${basename(abs)}"`)
  return sendStream(event, createReadStream(abs))
})
