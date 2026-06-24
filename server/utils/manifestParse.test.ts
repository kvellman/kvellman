import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// validateDoc loads the bundled winget schemas via useStorage('assets:winget-schemas'); stub it to
// read the committed JSON from disk so the real ajv validation runs without a Nitro server.
beforeAll(() => {
  vi.stubGlobal('useStorage', () => ({
    getItem: async (key: string) => {
      try {
        return JSON.parse(readFileSync(resolve(process.cwd(), 'server/schemas/winget', key), 'utf8'))
      } catch {
        return null
      }
    },
  }))
})

const { parseManifest, ManifestParseError } = await import('./manifestParse')

const SHA = 'ABCDEF0123456789'.repeat(4)

function singleton(opts: { url?: string; version?: string; extraInstaller?: string } = {}) {
  const { url = 'https://contoso.example/s.exe', version = '1.9.0', extraInstaller = '' } = opts
  return `PackageIdentifier: Contoso.App
PackageVersion: 1.0.0
PackageLocale: en-US
Publisher: Contoso Ltd
PackageName: Contoso App
License: MIT
ShortDescription: A test app.
Installers:
  - Architecture: x64
    InstallerType: exe
    InstallerUrl: ${url}
    InstallerSha256: ${SHA}${extraInstaller}
ManifestType: singleton
ManifestVersion: ${version}
`
}

describe('parseManifest — singleton', () => {
  it('parses a valid singleton into a structured payload', async () => {
    const p = await parseManifest([singleton()])
    expect(p.packageIdentifier).toBe('Contoso.App')
    expect(p.packageVersion).toBe('1.0.0')
    expect(p.manifestVersion).toBe('1.9.0')
    expect(p.installers[0].installerType).toBe('exe')
    expect(p.locales[0].isDefault).toBe(true)
  })

  it('preserves a $REPO_URL placeholder (sanitised only for validation)', async () => {
    const p = await parseManifest([singleton({ url: '$REPO_URL/contoso/s.exe' })])
    expect(p.installers[0].installerUrl).toBe('$REPO_URL/contoso/s.exe')
  })

  it('validates against the declared ManifestVersion (1.6.0)', async () => {
    const p = await parseManifest([singleton({ version: '1.6.0' })])
    expect(p.manifestVersion).toBe('1.6.0')
  })

  it('rejects a spec violation (InstallerSuccessCodes may not contain 0)', async () => {
    const yaml = singleton({ extraInstaller: '\n    InstallerSuccessCodes:\n      - 0' })
    await expect(parseManifest([yaml])).rejects.toBeInstanceOf(ManifestParseError)
  })

  it('rejects a document without a ManifestType', async () => {
    await expect(parseManifest(['PackageIdentifier: A.B\nPackageVersion: 1.0.0\n'])).rejects.toBeInstanceOf(
      ManifestParseError,
    )
  })
})

describe('parseManifest — multi-file', () => {
  it('assembles version + installer + defaultLocale documents', async () => {
    const version = `PackageIdentifier: Contoso.App
PackageVersion: 1.0.0
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.9.0`
    const installer = `PackageIdentifier: Contoso.App
PackageVersion: 1.0.0
Installers:
  - Architecture: x64
    InstallerType: exe
    InstallerUrl: https://contoso.example/s.exe
    InstallerSha256: ${SHA}
ManifestType: installer
ManifestVersion: 1.9.0`
    const locale = `PackageIdentifier: Contoso.App
PackageVersion: 1.0.0
PackageLocale: en-US
Publisher: Contoso Ltd
PackageName: Contoso App
License: MIT
ShortDescription: A test app.
ManifestType: defaultLocale
ManifestVersion: 1.9.0`
    const p = await parseManifest([[version, installer, locale].join('\n---\n')])
    expect(p.packageIdentifier).toBe('Contoso.App')
    expect(p.installers).toHaveLength(1)
    expect(p.locales[0].packageName).toBe('Contoso App')
  })

  it('rejects inconsistent identities across documents', async () => {
    const a = `PackageIdentifier: Contoso.App
PackageVersion: 1.0.0
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.9.0`
    const b = `PackageIdentifier: Other.App
PackageVersion: 1.0.0
PackageLocale: en-US
Publisher: P
PackageName: N
License: L
ShortDescription: D
ManifestType: defaultLocale
ManifestVersion: 1.9.0`
    await expect(parseManifest([[a, b].join('\n---\n')])).rejects.toBeInstanceOf(ManifestParseError)
  })
})
