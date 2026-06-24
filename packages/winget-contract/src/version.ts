// winget package version comparison. winget versions are not strict semver: they are
// dot-separated sequences whose segments may be numeric or alphanumeric (e.g. "0.100.0",
// "127.0", "1.2.3-beta", "2024.01"). This mirrors winget's comparison closely enough for
// update detection: compare segment by segment, numerically when both segments are integers,
// lexically otherwise; a missing segment counts as 0 so "1.0" == "1.0.0".

function splitSegments(v: string): string[] {
  // Split on '.', '-', '_', '+' and whitespace — the common winget version delimiters.
  return v
    .trim()
    .split(/[.\-_+\s]+/)
    .filter((s) => s.length > 0)
}

const INT_RE = /^\d+$/

// Returns <0 if a < b, 0 if equal, >0 if a > b.
export function compareWingetVersions(a: string, b: string): number {
  const sa = splitSegments(a)
  const sb = splitSegments(b)
  const len = Math.max(sa.length, sb.length)

  for (let i = 0; i < len; i++) {
    const x = sa[i] ?? '0'
    const y = sb[i] ?? '0'
    if (x === y) continue

    const xi = INT_RE.test(x)
    const yi = INT_RE.test(y)
    if (xi && yi) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d < 0 ? -1 : 1
    } else {
      // Numeric segment outranks an alphanumeric one (e.g. "1.0" > "1.0-beta").
      if (xi !== yi) return xi ? 1 : -1
      const d = x.localeCompare(y, undefined, { numeric: true })
      if (d !== 0) return d < 0 ? -1 : 1
    }
  }
  return 0
}

// True if `latest` is strictly newer than `current`.
export function isNewer(latest: string, current: string): boolean {
  return compareWingetVersions(latest, current) > 0
}

// Highest version from a list (winget ordering). Returns null for an empty list.
export function maxWingetVersion(versions: string[]): string | null {
  if (versions.length === 0) return null
  return versions.reduce((max, v) => (compareWingetVersions(v, max) > 0 ? v : max))
}
