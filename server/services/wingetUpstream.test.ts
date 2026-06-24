import { describe, expect, it } from 'vitest'
import { upstreamPath } from './wingetUpstream'

describe('upstreamPath', () => {
  it('maps a two-segment identifier to the winget-pkgs path', () => {
    expect(upstreamPath('Microsoft.PowerToys')).toBe('manifests/m/Microsoft/PowerToys')
  })
  it('nests every dotted segment as a directory', () => {
    expect(upstreamPath('Microsoft.VisualStudio.2022.Community')).toBe(
      'manifests/m/Microsoft/VisualStudio/2022/Community',
    )
  })
  it('lowercases only the first letter for the bucket', () => {
    expect(upstreamPath('Notepad++.Notepad++')).toBe('manifests/n/Notepad++/Notepad++')
  })
})
