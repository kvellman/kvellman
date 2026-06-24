import { verify as cryptoVerify } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { appSettings } from '../db/schema'

// Offline license / entitlement check for paid plugins (open-core). A license is an Ed25519-signed
// token "<base64url(payload)>.<base64url(signature)>" minted by the vendor; the core verifies it
// against the vendor public key (baked in, overridable via LICENSE_PUBLIC_KEY for testing). No
// phone-home — works air-gapped. Local accounts and all open-core features need no license.

// Vendor public key. The matching private key is held only by the vendor (never in the repo).
const VENDOR_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEALy3wpNnbvQF9kPFsN279Z6bhtpPGH5DXjr31J7lAFCM=
-----END PUBLIC KEY-----`

const LICENSE_KEY = 'license' // app_settings row holding the raw token

export interface LicensePayload {
  customer: string
  entitlements: string[]
  issuedAt?: string
  expiresAt?: string | null
}
export interface LicenseStatus {
  valid: boolean
  customer?: string
  entitlements: string[]
  expiresAt?: string | null
  expired?: boolean
}

function publicKey(): string {
  return (useRuntimeConfig().licensePublicKey as string) || VENDOR_PUBLIC_KEY
}

// Verify the signature and return the payload, or null if invalid/malformed.
export function verifyLicenseToken(token: string, pubPem = publicKey()): LicensePayload | null {
  const [data, sig] = token.trim().split('.')
  if (!data || !sig) return null
  try {
    if (!cryptoVerify(null, Buffer.from(data), pubPem, Buffer.from(sig, 'base64url'))) return null
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as LicensePayload
  } catch {
    return null
  }
}

async function storedToken(): Promise<string | null> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, LICENSE_KEY) })
  return row?.value ?? null
}

// Current license status (verified). Expired licenses are reported but grant no entitlements.
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const token = await storedToken()
  if (!token) return { valid: false, entitlements: [] }
  const p = verifyLicenseToken(token)
  if (!p) return { valid: false, entitlements: [] }
  const expired = !!p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()
  return {
    valid: true,
    customer: p.customer,
    entitlements: p.entitlements ?? [],
    expiresAt: p.expiresAt ?? null,
    expired,
  }
}

// Active entitlements (empty if no/invalid/expired license).
export async function getEntitlements(): Promise<string[]> {
  const s = await getLicenseStatus()
  return s.valid && !s.expired ? s.entitlements : []
}

export async function hasEntitlement(name: string): Promise<boolean> {
  return (await getEntitlements()).includes(name)
}

// Guard for paid-plugin endpoints: 403 unless the entitlement is active.
export async function requireEntitlement(name: string): Promise<void> {
  if (!(await hasEntitlement(name))) {
    throw createError({ statusCode: 403, statusMessage: `Feature "${name}" is not licensed` })
  }
}

// Store a license token after verifying it; throws on an invalid token.
export async function setLicenseToken(token: string): Promise<LicenseStatus> {
  if (!verifyLicenseToken(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid license' })
  }
  await db
    .insert(appSettings)
    .values({ key: LICENSE_KEY, value: token.trim() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: token.trim(), updatedAt: new Date() } })
  return getLicenseStatus()
}

export async function clearLicense(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, LICENSE_KEY))
}
