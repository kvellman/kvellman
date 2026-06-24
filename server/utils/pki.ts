import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import forge from 'node-forge'

// Tiny PKI for edge-node mTLS. The origin acts as a CA: it issues each node a client
// certificate (by signing the node's CSR at enrollment), and verifies the client cert a reverse
// proxy forwards on later requests. Pure-JS (node-forge) for air-gapped builds.

export interface CaPem {
  caKeyPem: string
  caCertPem: string
}
export interface CertVerification {
  ok: boolean
  commonName?: string
  notAfter?: Date
  fingerprint?: string
}

// --- pure crypto helpers (no fs) --------------------------------------------------------------

function fingerprintOf(cert: forge.pki.Certificate): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const md = forge.md.sha256.create()
  md.update(der)
  return md.digest().toHex()
}

export function certFingerprint(certPem: string): string {
  return fingerprintOf(forge.pki.certificateFromPem(certPem))
}

// Self-signed CA (key + cert PEM).
export function createCa(commonName = 'kvellman-node-CA', years = 10): CaPem {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + years)
  const attrs = [{ name: 'commonName', value: commonName }, { name: 'organizationName', value: 'kvellman' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())
  return { caKeyPem: forge.pki.privateKeyToPem(keys.privateKey), caCertPem: forge.pki.certificateToPem(cert) }
}

// Sign a node CSR with the CA → client certificate (clientAuth), valid `days`.
export function signCsr(ca: CaPem, csrPem: string, opts: { commonName: string; days?: number }): string {
  const csr = forge.pki.certificationRequestFromPem(csrPem)
  if (!csr.verify()) throw new Error('CSR self-signature invalid')
  if (!csr.publicKey) throw new Error('CSR has no public key')

  const caCert = forge.pki.certificateFromPem(ca.caCertPem)
  const caKey = forge.pki.privateKeyFromPem(ca.caKeyPem)

  const cert = forge.pki.createCertificate()
  cert.publicKey = csr.publicKey
  cert.serialNumber = Date.now().toString(16)
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + (opts.days ?? 90))
  cert.setSubject([{ name: 'commonName', value: opts.commonName }])
  cert.setIssuer(caCert.subject.attributes)
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', clientAuth: true },
  ])
  cert.sign(caKey, forge.md.sha256.create())
  return forge.pki.certificateToPem(cert)
}

// Verify a client cert is signed by the CA and currently valid.
export function verifyCert(caCertPem: string, certPem: string): CertVerification {
  try {
    const caCert = forge.pki.certificateFromPem(caCertPem)
    const cert = forge.pki.certificateFromPem(certPem)
    const now = new Date()
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) return { ok: false }
    const store = forge.pki.createCaStore([caCert])
    if (!forge.pki.verifyCertificateChain(store, [cert])) return { ok: false }
    const cn = cert.subject.getField('CN')?.value as string | undefined
    return { ok: true, commonName: cn, notAfter: cert.validity.notAfter, fingerprint: fingerprintOf(cert) }
  } catch {
    return { ok: false }
  }
}

// --- fs-backed CA for the origin --------------------------------------------------------------

function caPaths(dir: string) {
  return { key: join(dir, 'ca-key.pem'), cert: join(dir, 'ca-cert.pem') }
}

// Load the origin CA, creating + persisting it on first use.
export async function ensureCa(dir: string): Promise<CaPem> {
  const p = caPaths(dir)
  try {
    const [caKeyPem, caCertPem] = await Promise.all([readFile(p.key, 'utf8'), readFile(p.cert, 'utf8')])
    return { caKeyPem, caCertPem }
  } catch {
    const ca = createCa()
    await mkdir(dir, { recursive: true })
    await writeFile(p.key, ca.caKeyPem, { mode: 0o600 })
    await writeFile(p.cert, ca.caCertPem)
    return ca
  }
}
