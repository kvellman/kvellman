import { inArray, lt, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { telemetryDaily, telemetryEvents } from '../db/schema'

// Roll raw telemetry_events into telemetry_daily, then purge events past the retention window.
//
// Idempotent: it recomputes only the days that still have raw events (delete-then-insert per day),
// so re-running never double-counts. Aggregates for days whose raw events were already purged are
// left untouched — they were rolled up on an earlier run while their events still existed. As long
// as the rollup runs at least once per day (it ticks hourly), no day is purged before it is rolled
// up. Days are bucketed in UTC for determinism.
const DAY = sql<string>`(${telemetryEvents.createdAt} AT TIME ZONE 'UTC')::date`

export async function runTelemetryRollup(
  retentionDays = 90,
): Promise<{ days: number; rows: number; purged: number }> {
  // Aggregate every current raw event by day + dimensions.
  const agg = await db
    .select({
      day: DAY,
      eventType: telemetryEvents.eventType,
      packageIdentifier: telemetryEvents.packageIdentifier,
      packageVersion: telemetryEvents.packageVersion,
      site: telemetryEvents.site,
      wingetVersion: telemetryEvents.wingetVersion,
      count: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .groupBy(
      DAY,
      telemetryEvents.eventType,
      telemetryEvents.packageIdentifier,
      telemetryEvents.packageVersion,
      telemetryEvents.site,
      telemetryEvents.wingetVersion,
    )

  const days = [...new Set(agg.map((r) => r.day))]
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  let purged = 0
  await db.transaction(async (tx) => {
    if (days.length) {
      // Replace the affected days so the rollup exactly mirrors the surviving raw events.
      await tx.delete(telemetryDaily).where(inArray(telemetryDaily.day, days))
      await tx.insert(telemetryDaily).values(agg)
    }
    const [stale] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(telemetryEvents)
      .where(lt(telemetryEvents.createdAt, cutoff))
    purged = stale?.c ?? 0
    if (purged) await tx.delete(telemetryEvents).where(lt(telemetryEvents.createdAt, cutoff))
  })

  return { days: days.length, rows: agg.length, purged }
}
