import { once } from 'node:events'
import https from 'node:https'
import type { AddressInfo } from 'node:net'
import forge from 'node-forge'
import { beforeAll, describe, expect, it } from 'vitest'
import { type CaPem, certFingerprint, createCa, signCsr, verifyCert } from './pki'

// Build a CSR + its private key (PEM) like a node would at enrollment.
function makeCsr(commonName: string): { csrPem: string; keyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const csr = forge.pki.createCertificationRequest()
  csr.publicKey = keys.publicKey
  csr.setSubject([{ name: 'commonName', value: commonName }])
  csr.sign(keys.privateKey, forge.md.sha256.create())
  return {
    csrPem: forge.pki.certificationRequestToPem(csr),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
  }
}

let ca: CaPem
let node: { csrPem: string; keyPem: string }
let nodeCertPem: string

beforeAll(() => {
  ca = createCa()
  node = makeCsr('node-1')
  nodeCertPem = signCsr(ca, node.csrPem, { commonName: 'node-1' })
})

describe('pki issuance', () => {
  it('issues a cert that verifies against the CA', () => {
    const v = verifyCert(ca.caCertPem, nodeCertPem)
    expect(v.ok).toBe(true)
    expect(v.commonName).toBe('node-1')
    expect(v.fingerprint).toBe(certFingerprint(nodeCertPem))
  })

  it('rejects a cert signed by a different CA', () => {
    const otherCa = createCa('other-CA')
    expect(verifyCert(otherCa.caCertPem, nodeCertPem).ok).toBe(false)
  })

  it('rejects garbage', () => {
    expect(verifyCert(ca.caCertPem, 'not a cert').ok).toBe(false)
  })

  it('rejects a CSR with a broken self-signature', () => {
    // Tamper: swap the key so the CSR signature no longer matches its public key.
    const a = makeCsr('x')
    const b = makeCsr('x')
    const broken = a.csrPem.slice(0, -40) + b.csrPem.slice(-40)
    expect(() => signCsr(ca, broken, { commonName: 'x' })).toThrow()
  })
})

describe('real mTLS handshake', () => {
  it('a CA-issued client cert authenticates; a foreign one is rejected', async () => {
    // Server requires + verifies client certs against our CA (the reverse-proxy role).
    const server = https.createServer(
      { key: ca.caKeyPem, cert: ca.caCertPem, ca: [ca.caCertPem], requestCert: true, rejectUnauthorized: true },
      (req, res) => {
        const cert = (req.socket as import('node:tls').TLSSocket).getPeerCertificate()
        res.end(JSON.stringify({ authorized: (req.socket as import('node:tls').TLSSocket).authorized, cn: cert.subject?.CN }))
      },
    )
    server.listen(0)
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port

    const get = (opts: https.RequestOptions) =>
      new Promise<{ status?: number; body: string }>((resolve, reject) => {
        const r = https.request({ host: '127.0.0.1', port, method: 'GET', rejectUnauthorized: false, ...opts }, (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => resolve({ status: res.statusCode, body }))
        })
        r.on('error', reject)
        r.end()
      })

    // Valid node cert → authorized.
    const ok = await get({ cert: nodeCertPem, key: node.keyPem })
    expect(JSON.parse(ok.body)).toMatchObject({ authorized: true, cn: 'node-1' })

    // Cert from a different CA → handshake rejected.
    const otherCa = createCa('rogue')
    const rogue = makeCsr('rogue-node')
    const rogueCert = signCsr(otherCa, rogue.csrPem, { commonName: 'rogue-node' })
    await expect(get({ cert: rogueCert, key: rogue.keyPem })).rejects.toBeTruthy()

    server.close()
  }, 30000)
})
