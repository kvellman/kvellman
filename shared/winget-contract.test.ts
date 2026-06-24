import { describe, expect, it } from 'vitest'
import { compareWingetVersions, isNewer, maxWingetVersion } from '@kvellman/winget-contract'

describe('compareWingetVersions', () => {
  it('compares numeric segments numerically, not lexically', () => {
    // The case that breaks naive string compare: "81" vs "100".
    expect(compareWingetVersions('0.81.0', '0.100.0')).toBeLessThan(0)
    expect(compareWingetVersions('0.100.0', '0.81.0')).toBeGreaterThan(0)
  })

  it('handles differing segment counts (missing = 0)', () => {
    expect(compareWingetVersions('1.0', '1.0.0')).toBe(0)
    expect(compareWingetVersions('127.0', '151.0.4')).toBeLessThan(0)
    expect(compareWingetVersions('1.2.3', '1.2')).toBeGreaterThan(0)
  })

  it('treats equal versions as equal', () => {
    expect(compareWingetVersions('3.0.23', '3.0.23')).toBe(0)
  })

  it('ranks a release above a prerelease', () => {
    expect(compareWingetVersions('1.0', '1.0-beta')).toBeGreaterThan(0)
    expect(compareWingetVersions('2.0.0', '2.0.0-rc1')).toBeGreaterThan(0)
  })

  it('compares alphanumeric segments sensibly', () => {
    expect(compareWingetVersions('1.0-beta', '1.0-alpha')).toBeGreaterThan(0)
  })

  it('tolerates mixed delimiters and whitespace', () => {
    expect(compareWingetVersions('2024.01', '2024_01')).toBe(0)
    expect(compareWingetVersions(' 1.2.0 ', '1.2.0')).toBe(0)
  })
})

describe('isNewer', () => {
  it('is true only when latest strictly exceeds current', () => {
    expect(isNewer('0.100.0', '0.81.0')).toBe(true)
    expect(isNewer('0.81.0', '0.81.0')).toBe(false)
    expect(isNewer('0.80.0', '0.81.0')).toBe(false)
  })
})

describe('maxWingetVersion', () => {
  it('returns the highest by winget ordering', () => {
    expect(maxWingetVersion(['1.0.0', '1.10.0', '1.2.0'])).toBe('1.10.0')
    expect(maxWingetVersion(['0.81.0', '0.100.0'])).toBe('0.100.0')
  })
  it('returns null for an empty list', () => {
    expect(maxWingetVersion([])).toBeNull()
  })
})
