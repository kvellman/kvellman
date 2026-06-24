import { describe, expect, it } from 'vitest'
import { buildInstallerDoc, buildSingletonDoc } from './manifestYaml'

describe('buildInstallerDoc', () => {
  it('maps camelCase to winget PascalCase, preserves placeholders, omits empties', () => {
    const doc = buildInstallerDoc({
      architecture: 'x64',
      installerType: 'exe',
      installerUrl: '$REPO_URL/s.exe',
      installerSha256: 'A'.repeat(64),
      scope: null,
      upgradeBehavior: 'install',
      commands: [],
      localFile: 'x/y',
    })
    expect(doc.Architecture).toBe('x64')
    expect(doc.InstallerUrl).toBe('$REPO_URL/s.exe') // placeholder preserved
    expect(doc.UpgradeBehavior).toBe('install')
    expect(doc).not.toHaveProperty('Scope') // null omitted
    expect(doc).not.toHaveProperty('Commands') // empty array omitted
    expect(doc).not.toHaveProperty('LocalFile') // server-only, never emitted
  })

  it('re-PascalCases AppsAndFeaturesEntries and Dependencies', () => {
    const doc = buildInstallerDoc({
      architecture: 'x64',
      installerType: 'exe',
      installerUrl: 'u',
      installerSha256: 'A'.repeat(64),
      appsAndFeaturesEntries: [{ displayName: 'X', productCode: '{1}' }],
      dependencies: {
        windowsFeatures: ['NetFx3'],
        packageDependencies: [{ packageIdentifier: 'A.B', minimumVersion: '1.0' }],
      },
    })
    expect(doc.AppsAndFeaturesEntries).toEqual([{ DisplayName: 'X', ProductCode: '{1}' }])
    expect(doc.Dependencies).toEqual({
      WindowsFeatures: ['NetFx3'],
      PackageDependencies: [{ PackageIdentifier: 'A.B', MinimumVersion: '1.0' }],
    })
  })
})

describe('buildSingletonDoc', () => {
  it('puts default-locale fields at root and stamps ManifestType/Version', () => {
    const doc = buildSingletonDoc({
      packageIdentifier: 'A.B',
      packageVersion: '1.0.0',
      manifestVersion: '1.9.0',
      locales: [
        { packageLocale: 'en-US', publisher: 'P', packageName: 'N', license: 'L', shortDescription: 'D', tags: ['x'], isDefault: true },
      ],
      installers: [{ architecture: 'x64', installerType: 'exe', installerUrl: 'u', installerSha256: 'A'.repeat(64) }],
    })
    expect(doc.PackageIdentifier).toBe('A.B')
    expect(doc.PackageName).toBe('N')
    expect(doc.Tags).toEqual(['x'])
    expect(doc.ManifestType).toBe('singleton')
    expect(doc.ManifestVersion).toBe('1.9.0')
    expect(Array.isArray(doc.Installers)).toBe(true)
  })
})
