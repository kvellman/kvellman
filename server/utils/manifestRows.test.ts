import { describe, expect, it } from 'vitest'
import { installerView, localeView, toInstallerInsert, toLocaleInsert } from './manifestRows'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('toInstallerInsert', () => {
  it('strips id/versionId from edit state and sets the target versionId', () => {
    const row = toInstallerInsert(5, {
      id: 99,
      versionId: 7,
      architecture: 'x64',
      installerType: 'exe',
      installerUrl: 'u',
      installerSha256: 'A'.repeat(64),
    } as any)
    expect(row.versionId).toBe(5)
    expect((row as any).id).toBeUndefined()
  })
})

describe('toLocaleInsert', () => {
  it('strips id/versionId and sets the target versionId', () => {
    const row = toLocaleInsert(5, {
      id: 1,
      versionId: 7,
      packageLocale: 'en-US',
      publisher: 'p',
      packageName: 'n',
      shortDescription: 'd',
      license: 'l',
      tags: [],
      isDefault: true,
    } as any)
    expect(row.versionId).toBe(5)
    expect((row as any).id).toBeUndefined()
  })
})

describe('views', () => {
  it('installerView keeps id (for upload addressing) but drops versionId', () => {
    const v = installerView({
      id: 99,
      versionId: 7,
      architecture: 'x64',
      installerType: 'exe',
      installerUrl: 'u',
      installerSha256: 'A'.repeat(64),
    } as any)
    expect(v.id).toBe(99)
    expect((v as any).versionId).toBeUndefined()
  })
  it('localeView drops id and versionId', () => {
    const v = localeView({ id: 1, versionId: 2, packageLocale: 'en-US', isDefault: true } as any)
    expect((v as any).id).toBeUndefined()
    expect((v as any).versionId).toBeUndefined()
    expect(v.packageLocale).toBe('en-US')
  })
})
