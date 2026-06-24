import { describe, expect, it } from 'vitest'
import {
  INSTALLER_TYPES,
  installerSchema,
  localeSchema,
  manifestCreateSchema,
  versionEditSchema,
} from './manifest'

const validLocale = {
  packageLocale: 'en-US',
  packageName: 'App',
  publisher: 'Pub',
  shortDescription: 'Desc',
  license: 'MIT',
  isDefault: true,
}
const validInstaller = {
  architecture: 'x64',
  installerType: 'exe',
  installerUrl: 'https://x/y',
  installerSha256: 'A'.repeat(64),
}

describe('localeSchema', () => {
  it('accepts a valid locale', () => {
    expect(localeSchema.safeParse(validLocale).success).toBe(true)
  })
  it('rejects a non-BCP-47 locale', () => {
    expect(localeSchema.safeParse({ ...validLocale, packageLocale: 'english' }).success).toBe(false)
  })
  it('rejects an over-long license (>512)', () => {
    expect(localeSchema.safeParse({ ...validLocale, license: 'x'.repeat(513) }).success).toBe(false)
  })
  it('allows placeholder-free optional URLs to be empty/absent', () => {
    expect(localeSchema.safeParse({ ...validLocale, publisherUrl: '' }).success).toBe(true)
  })
  it('accepts an additional (non-default) locale carrying only PackageLocale', () => {
    // winget `locale` files require only PackageLocale; the rest are defaultLocale-only.
    expect(localeSchema.safeParse({ packageLocale: 'de-DE', isDefault: false }).success).toBe(true)
  })
  it('requires name/publisher/description/license for the default locale', () => {
    const r = localeSchema.safeParse({ packageLocale: 'en-US', isDefault: true })
    expect(r.success).toBe(false)
  })
})

describe('installerSchema', () => {
  it('accepts a valid installer', () => {
    expect(installerSchema.safeParse(validInstaller).success).toBe(true)
  })
  it('does not allow msstore (not a winget installer type)', () => {
    expect(INSTALLER_TYPES).not.toContain('msstore')
    expect(installerSchema.safeParse({ ...validInstaller, installerType: 'msstore' }).success).toBe(false)
  })
  it('rejects a malformed SHA-256', () => {
    expect(installerSchema.safeParse({ ...validInstaller, installerSha256: 'xyz' }).success).toBe(false)
  })
  it('rejects a switch value over 2048 chars', () => {
    expect(
      installerSchema.safeParse({ ...validInstaller, installerSwitches: { Custom: 'x'.repeat(2049) } }).success,
    ).toBe(false)
  })
  it('keeps a placeholder InstallerUrl valid', () => {
    expect(installerSchema.safeParse({ ...validInstaller, installerUrl: '$REPO_URL/s.exe' }).success).toBe(true)
  })
})

describe('versionEditSchema', () => {
  it('requires exactly one default locale', () => {
    const twoDefaults = {
      locales: [validLocale, { ...validLocale, packageLocale: 'de-DE', isDefault: true }],
      installers: [validInstaller],
    }
    expect(versionEditSchema.safeParse(twoDefaults).success).toBe(false)
  })
  it('accepts one default locale + one installer', () => {
    expect(versionEditSchema.safeParse({ locales: [validLocale], installers: [validInstaller] }).success).toBe(true)
  })
})

describe('manifestCreateSchema', () => {
  const base = { packageVersion: '1.0.0', manifestVersion: '1.9.0', locales: [validLocale], installers: [validInstaller] }
  it('accepts a dotted package identifier', () => {
    expect(manifestCreateSchema.safeParse({ ...base, packageIdentifier: 'Publisher.Package' }).success).toBe(true)
  })
  it('rejects a non-dotted identifier', () => {
    expect(manifestCreateSchema.safeParse({ ...base, packageIdentifier: 'Package' }).success).toBe(false)
  })
})
