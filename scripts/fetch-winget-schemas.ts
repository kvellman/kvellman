// Bundles the official winget manifest JSON schemas locally (air-gapped requirement).
// Run once per schema version you want to support; the downloaded files are committed under
// server/schemas/winget/<version>/ and loaded by server/utils/wingetSchemas.ts.
//
//   pnpm tsx scripts/fetch-winget-schemas.ts
//
// To add a new schema line later, append to VERSIONS and re-run.

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const VERSIONS = [
  '1.0.0',
  '1.1.0',
  '1.2.0',
  '1.4.0',
  '1.5.0',
  '1.6.0',
  '1.7.0',
  '1.9.0',
  '1.10.0',
  '1.12.0',
]
const TYPES = ['singleton', 'version', 'installer', 'defaultLocale', 'locale'] as const
const BASE = 'https://raw.githubusercontent.com/microsoft/winget-cli/master/schemas/JSON/manifests'

async function run() {
  for (const version of VERSIONS) {
    const outDir = resolve(process.cwd(), 'server/schemas/winget', version)
    await mkdir(outDir, { recursive: true })
    for (const type of TYPES) {
      const file = `manifest.${type}.${version}.json`
      const url = `${BASE}/v${version}/${file}`
      const res = await fetch(url)
      if (res.status === 404) {
        console.warn(`· ${version}/${file} not present upstream — skipped`)
        continue
      }
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
      const json = await res.json()
      await writeFile(resolve(outDir, file), JSON.stringify(json, null, 2) + '\n')
      console.log(`✓ ${version}/${file}`)
    }
  }
  console.log(`Bundled ${VERSIONS.length} version(s).`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
