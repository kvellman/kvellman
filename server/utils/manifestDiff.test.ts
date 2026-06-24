import { describe, expect, it } from 'vitest'
import { diffManifest } from './manifestDiff'

const base = {
  manifestVersion: '1.9.0',
  locales: [{ packageLocale: 'en-US', license: 'MIT', publisher: 'P' }],
  installers: [{ architecture: 'x64', installerType: 'exe', installerUrl: 'https://u', installerSwitches: { Silent: '/S' } }],
}

describe('diffManifest', () => {
  it('reports no changes for identical manifests', () => {
    expect(diffManifest(base, structuredClone(base))).toEqual([])
  })

  it('detects a changed locale scalar field', () => {
    const eff = structuredClone(base)
    eff.locales[0].license = 'Proprietary'
    const d = diffManifest(base, eff)
    expect(d).toContainEqual({ field: 'locale[en-US].license', upstream: 'MIT', overlay: 'Proprietary' })
  })

  it('detects a changed installer URL and switches object', () => {
    const eff = structuredClone(base)
    eff.installers[0].installerUrl = 'https://mirror/u'
    eff.installers[0].installerSwitches = { Silent: '/quiet' }
    const d = diffManifest(base, eff)
    expect(d.some((c) => c.field === 'installer[x64/exe].installerUrl')).toBe(true)
    expect(d.some((c) => c.field === 'installer[x64/exe].installerSwitches')).toBe(true)
  })

  it('detects manifestVersion changes and added installers', () => {
    const eff = structuredClone(base)
    eff.manifestVersion = '1.12.0'
    eff.installers.push({ architecture: 'arm64', installerType: 'exe', installerUrl: 'https://a' })
    const d = diffManifest(base, eff)
    expect(d).toContainEqual({ field: 'manifestVersion', upstream: '1.9.0', overlay: '1.12.0' })
    expect(d).toContainEqual({ field: 'installer[arm64/exe]', upstream: '(none)', overlay: '(added)' })
  })

  it('ignores the internal id field', () => {
    const up = structuredClone(base)
    const eff = structuredClone(base)
    up.installers[0].id = 1
    eff.installers[0].id = 2
    expect(diffManifest(up, eff)).toEqual([])
  })
})
