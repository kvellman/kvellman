import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client'
import { nodes } from '../../db/schema'
import { generateSecret, hashSecret } from '../../utils/nodeAuth'
import { certFingerprint, ensureCa, signCsr } from '../../utils/pki'

const schema = z.object({
  enrollmentKey: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  info: z.record(z.string(), z.unknown()).optional(),
  // PEM CSR — when present the origin CA issues an mTLS client certificate.
  csr: z.string().min(1).optional(),
})

// POST /api/nodes/enroll — a node exchanges its one-time enrollment key for a durable bearer token.
// Public + self-authenticated (exempt from the session middleware).
export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  const { enrollmentKey, name, info, csr } = parsed.data

  const node = await db.query.nodes.findFirst({
    where: eq(nodes.enrollmentKeyHash, hashSecret(enrollmentKey)),
  })
  if (!node) throw createError({ statusCode: 401, statusMessage: 'Invalid enrollment key' })
  if (node.status !== 'pending' || node.tokenHash) {
    throw createError({ statusCode: 409, statusMessage: 'Enrollment key already used' })
  }

  // Issue an mTLS client certificate from the CSR (preferred), plus a bearer token (fallback/dev).
  let certificate: string | undefined
  let caCertificate: string | undefined
  let certFp: string | null = null
  let certNotAfter: Date | null = null
  if (csr) {
    const ca = await ensureCa(useRuntimeConfig().pkiDir as string)
    try {
      certificate = signCsr(ca, csr, { commonName: `node-${node.id}`, days: 90 })
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid CSR' })
    }
    caCertificate = ca.caCertPem
    certFp = certFingerprint(certificate)
    certNotAfter = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }

  const nodeToken = generateSecret()
  await db
    .update(nodes)
    .set({
      status: 'active',
      tokenHash: hashSecret(nodeToken),
      certFingerprint: certFp,
      certNotAfter,
      enrolledAt: new Date(),
      lastSeenAt: new Date(),
      name: name?.trim() || node.name,
      lastInfo: info ?? null,
    })
    .where(eq(nodes.id, node.id))

  return { nodeId: node.id, nodeToken, certificate, caCertificate }
})
