import { writeFileSync, existsSync } from 'node:fs'
import { generateKeyPairSync } from 'node:crypto'

// Vendor tool (run ONCE): generate the Ed25519 license signing key pair.
//
//   tsx scripts/gen-license-key.ts [--key .license-signing-key.pem]
//
// Writes the PRIVATE key to the key file (keep it secret — it is gitignored) and prints the PUBLIC
// key PEM to stdout. Paste that public key into VENDOR_PUBLIC_KEY in server/utils/license.ts (it
// ships baked into the product so every install can verify licenses offline). The private key never
// leaves the vendor and is used only by scripts/sign-license.ts.

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const keyFile = arg('key', '.license-signing-key.pem')
if (existsSync(keyFile)) {
  console.error(`Refusing to overwrite existing ${keyFile} — delete it first if you really mean to rotate the key.`)
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { mode: 0o600 })

console.error(`Private key written to ${keyFile} (mode 600, keep it secret — it is gitignored).`)
console.error('Paste the public key below into VENDOR_PUBLIC_KEY in server/utils/license.ts:\n')
console.log((publicKey.export({ type: 'spki', format: 'pem' }) as string).trim())
