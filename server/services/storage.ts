import { createHash } from 'node:crypto'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

// Local installer-binary store (M1: filesystem; swappable for S3/MinIO later behind this module).
// Layout: <root>/<packageIdentifier>/<packageVersion>/<filename>. Paths are identity-based so they
// survive manifest edits (which re-create installer rows).

export function installerStoreRoot(): string {
  const cfg = (useRuntimeConfig().installerStore as string) || './data/installers'
  return resolve(process.cwd(), cfg)
}

function sanitizeSegment(seg: string): string {
  return seg.replace(/[^a-zA-Z0-9._-]/g, '_')
}
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'installer.bin'
}

// Resolve a stored relative path to an absolute path, rejecting traversal outside the root.
export function resolveStored(relPath: string): string {
  const root = installerStoreRoot()
  const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (clean.split('/').some((s) => s === '..' || s === '')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }
  const abs = resolve(root, clean)
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }
  return abs
}

export async function storeInstaller(
  packageIdentifier: string,
  packageVersion: string,
  filename: string,
  data: Buffer,
): Promise<{ relPath: string; sha256: string }> {
  const relPath = `${sanitizeSegment(packageIdentifier)}/${sanitizeSegment(packageVersion)}/${sanitizeFilename(filename)}`
  const abs = join(installerStoreRoot(), relPath)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  const sha256 = createHash('sha256').update(data).digest('hex').toUpperCase()
  return { relPath, sha256 }
}

export async function removeStored(relPath: string): Promise<void> {
  try {
    await unlink(resolveStored(relPath))
  } catch {
    // already gone — nothing to do
  }
}

// Store-relative directory for a package (and optionally version), using the same sanitization as
// storeInstaller — so deletes target the right folder.
export function installerDir(packageIdentifier: string, packageVersion?: string): string {
  const p = sanitizeSegment(packageIdentifier)
  return packageVersion ? `${p}/${sanitizeSegment(packageVersion)}` : p
}

export async function removeStoredDir(relDir: string): Promise<void> {
  try {
    await rm(resolveStored(relDir), { recursive: true, force: true })
  } catch {
    // nothing to remove
  }
}
