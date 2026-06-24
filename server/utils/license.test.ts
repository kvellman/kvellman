import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { type LicensePayload, verifyLicenseToken } from './license'

// A throwaway keypair stands in for the vendor's; verifyLicenseToken takes the public key explicitly.
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

function mint(payload: LicensePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = cryptoSign(null, Buffer.from(data), privPem).toString('base64url')
  return `${data}.${sig}`
}

describe('verifyLicenseToken', () => {
  it('accepts a validly signed token and returns the payload', () => {
    const token = mint({ customer: 'Contoso', entitlements: ['sso', 'mfa'], expiresAt: null })
    const p = verifyLicenseToken(token, pubPem)
    expect(p).not.toBeNull()
    expect(p?.customer).toBe('Contoso')
    expect(p?.entitlements).toEqual(['sso', 'mfa'])
  })

  it('rejects a token signed by a different key', () => {
    const other = generateKeyPairSync('ed25519')
    const otherPub = other.publicKey.export({ type: 'spki', format: 'pem' }) as string
    const token = mint({ customer: 'X', entitlements: ['sso'] })
    expect(verifyLicenseToken(token, otherPub)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = mint({ customer: 'X', entitlements: ['viewer'] })
    const [data, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ customer: 'X', entitlements: ['sso', 'mfa'] })).toString('base64url')
    expect(verifyLicenseToken(`${forged}.${sig}`, pubPem)).toBeNull()
    expect(verifyLicenseToken(`${data}.${sig}`, pubPem)).not.toBeNull()
  })

  it('rejects malformed tokens', () => {
    expect(verifyLicenseToken('garbage', pubPem)).toBeNull()
    expect(verifyLicenseToken('', pubPem)).toBeNull()
  })
})
