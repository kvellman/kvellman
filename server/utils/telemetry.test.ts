import { describe, expect, it } from 'vitest'
import { parseWingetVersion } from './telemetry'

describe('parseWingetVersion', () => {
  it('parses the WindowsPackageManager UA token', () => {
    expect(
      parseWingetVersion('winget-cli WindowsPackageManager/1.6.3482 DesktopAppInstaller/Microsoft.DesktopAppInstaller'),
    ).toBe('1.6.3482')
  })

  it('parses the short winget-cli/<ver> form', () => {
    expect(parseWingetVersion('winget-cli/1.7.10661')).toBe('1.7.10661')
  })

  it('handles two-segment versions', () => {
    expect(parseWingetVersion('WindowsPackageManager/1.9')).toBe('1.9')
  })

  it('returns null for non-winget or missing UA', () => {
    expect(parseWingetVersion('Mozilla/5.0')).toBeNull()
    expect(parseWingetVersion(undefined)).toBeNull()
    expect(parseWingetVersion('')).toBeNull()
  })
})
