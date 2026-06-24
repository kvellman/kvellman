import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { nodes } from '../db/schema'
import { ensureCa, verifyCert } from './pki'

// Secrets for edge-node enrollment/auth: random, opaque, stored only as a SHA-256 hash.
export function generateSecret(): string {
  return randomBytes(24).toString('base64url')
}
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

// Authenticate a node request. Preferred: an mTLS client certificate that a reverse proxy verified
// and forwards (URL-encoded PEM in the configured header) — re-verified here against the origin CA
// and matched by fingerprint. Fallback: `Authorization: Bearer <node-token>` (dev / no proxy).
// Returns the active node or throws 401.
export async function requireNode(event: H3Event) {
  const cfg = useRuntimeConfig()

  // 1. mTLS client certificate forwarded by the proxy.
  const rawCert = getHeader(event, cfg.nodeCertHeader as string)
  if (rawCert) {
    const certPem = decodeURIComponent(rawCert).trim()
    const ca = await ensureCa(cfg.pkiDir as string)
    const v = verifyCert(ca.caCertPem, certPem)
    if (!v.ok || !v.fingerprint) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid client certificate' })
    }
    const node = await db.query.nodes.findFirst({ where: eq(nodes.certFingerprint, v.fingerprint) })
    if (!node || node.status !== 'active') {
      throw createError({ statusCode: 401, statusMessage: 'Unknown or revoked node certificate' })
    }
    return node
  }

  // 2. Bearer token fallback.
  const auth = getHeader(event, 'authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Missing node credential' })

  const node = await db.query.nodes.findFirst({ where: eq(nodes.tokenHash, hashSecret(token)) })
  if (!node || node.status !== 'active') {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked node token' })
  }
  return node
}
