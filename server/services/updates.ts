import { isNewer, maxWingetVersion } from '@kvellman/winget-contract'
import { db } from '../db/client'

export interface AvailableUpdate {
  packageIdentifier: string
  packageName: string
  currentVersion: string
  latestVersion: string
}

// Detect packages that have a newer version available upstream, using the locally synced winget
// catalog (upstream_catalog.latestVersion). Compares our highest stored version against the
// catalog's latest with the winget version comparator. Packages absent from the catalog (e.g. own
// 'local' packages) yield no result. Pure read; the import flow handles pulling the new version.
export async function detectUpdates(): Promise<AvailableUpdate[]> {
  const pkgs = await db.query.packages.findMany({
    with: { versions: { columns: { packageVersion: true } } },
  })

  // One catalog lookup map keyed by identifier.
  const catalog = await db.query.upstreamCatalog.findMany({
    columns: { packageIdentifier: true, latestVersion: true },
  })
  const latestByIdentifier = new Map(catalog.map((c) => [c.packageIdentifier, c.latestVersion]))

  const updates: AvailableUpdate[] = []
  for (const p of pkgs) {
    const latest = latestByIdentifier.get(p.packageIdentifier)
    if (!latest) continue
    const current = maxWingetVersion(p.versions.map((v) => v.packageVersion))
    if (!current) continue
    if (isNewer(latest, current)) {
      updates.push({
        packageIdentifier: p.packageIdentifier,
        packageName: p.packageName,
        currentVersion: current,
        latestVersion: latest,
      })
    }
  }
  // Stable, predictable ordering for the UI.
  updates.sort((a, b) => a.packageName.localeCompare(b.packageName))
  return updates
}
