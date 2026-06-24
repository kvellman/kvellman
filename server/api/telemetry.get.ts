import { gte, lt, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { telemetryDaily, telemetryEvents } from '../db/schema'

// GET /api/telemetry — repository-usage aggregates for the dashboard. Past days come from the rolled
// up telemetry_daily; the current (UTC) day is read live from raw telemetry_events so today's winget
// activity shows immediately, before the hourly rollup. daily is filtered to days < today, so the
// live current-day rows are never double-counted. `enabled` reflects TELEMETRY_ENABLED so the UI can
// explain an empty state (off vs. no traffic). These are observed request signals (searches,
// manifest fetches, real installer downloads), not install-success events — winget exposes none.

interface Row {
  eventType: string
  packageIdentifier: string | null
  wingetVersion: string | null
  site: string | null
  count: number
}

export default defineEventHandler(async () => {
  const enabled = !!useRuntimeConfig().telemetryEnabled

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const todayStr = todayStart.toISOString().slice(0, 10)

  // Past days from the rollup.
  const dailyRows = (await db
    .select({
      eventType: telemetryDaily.eventType,
      packageIdentifier: telemetryDaily.packageIdentifier,
      wingetVersion: telemetryDaily.wingetVersion,
      site: telemetryDaily.site,
      count: telemetryDaily.count,
    })
    .from(telemetryDaily)
    .where(lt(telemetryDaily.day, todayStr))) as Row[]

  // Current day live from raw events, aggregated the same way the rollup would.
  const todayRows = (await db
    .select({
      eventType: telemetryEvents.eventType,
      packageIdentifier: telemetryEvents.packageIdentifier,
      wingetVersion: telemetryEvents.wingetVersion,
      site: telemetryEvents.site,
      count: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(gte(telemetryEvents.createdAt, todayStart))
    .groupBy(
      telemetryEvents.eventType,
      telemetryEvents.packageIdentifier,
      telemetryEvents.wingetVersion,
      telemetryEvents.site,
    )) as Row[]

  const rows = [...dailyRows, ...todayRows]

  const totals = { searches: 0, fetches: 0, downloads: 0 }
  const pkgMap = new Map<string, { packageIdentifier: string; fetches: number; downloads: number }>()
  const verMap = new Map<string, number>()
  const siteMap = new Map<string, number>()

  for (const r of rows) {
    if (r.eventType === 'search') totals.searches += r.count
    else if (r.eventType === 'manifest.fetch') totals.fetches += r.count
    else if (r.eventType === 'installer.download') totals.downloads += r.count

    if (r.packageIdentifier && (r.eventType === 'manifest.fetch' || r.eventType === 'installer.download')) {
      const e = pkgMap.get(r.packageIdentifier) ?? { packageIdentifier: r.packageIdentifier, fetches: 0, downloads: 0 }
      if (r.eventType === 'manifest.fetch') e.fetches += r.count
      else e.downloads += r.count
      pkgMap.set(r.packageIdentifier, e)
    }
    if (r.wingetVersion) verMap.set(r.wingetVersion, (verMap.get(r.wingetVersion) ?? 0) + r.count)
    if (r.site) siteMap.set(r.site, (siteMap.get(r.site) ?? 0) + r.count)
  }

  const topPackages = [...pkgMap.values()]
    .sort((a, b) => b.fetches + b.downloads - (a.fetches + a.downloads))
    .slice(0, 10)
  const byWingetVersion = [...verMap.entries()]
    .map(([wingetVersion, count]) => ({ wingetVersion, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  const bySite = [...siteMap.entries()]
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return { enabled, totals, topPackages, byWingetVersion, bySite }
})
