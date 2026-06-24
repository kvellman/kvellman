import { readFileSync } from 'node:fs'
import { sign as cryptoSign } from 'node:crypto'

// Vendor tool: mint an Ed25519-signed license token. The private key never ships with the product.
//
// Usage:
//   tsx scripts/sign-license.ts --customer "Contoso" --entitlements sso,mfa --days 365 \
//     [--key .license-signing-key.pem]
//
// Prints the token to paste into the admin UI (Admin → License).

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const customer = arg('customer')
if (!customer) {
  console.error('--customer is required')
  process.exit(1)
}
const entitlements = arg('entitlements')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const days = Number(arg('days', '365'))
const keyFile = arg('key', '.license-signing-key.pem')

const payload = {
  customer,
  entitlements,
  issuedAt: new Date().toISOString(),
  expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null,
}

const privateKey = readFileSync(keyFile, 'utf8')
const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
const sig = cryptoSign(null, Buffer.from(data), privateKey).toString('base64url')

console.log(`${data}.${sig}`)
console.error(`Signed license for "${customer}" — entitlements: [${entitlements.join(', ')}], expires: ${payload.expiresAt ?? 'never'}`)
