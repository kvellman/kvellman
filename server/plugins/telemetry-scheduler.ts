import { runTelemetryRollup } from '../utils/runTelemetryRollup'

// In-process telemetry aggregator (Community/single-node). Hourly it rolls raw telemetry_events
// into telemetry_daily and purges events past the retention window. Opt-in via TELEMETRY_ENABLED;
// retention via TELEMETRY_RETENTION_DAYS (default 90). For Enterprise/HA this would move to a BullMQ
// worker, but runTelemetryRollup is shared.
export default defineNitroPlugin(() => {
  const cfg = useRuntimeConfig()
  if (!cfg.telemetryEnabled) return

  const retentionDays = Math.max(1, Number(cfg.telemetryRetentionDays) || 90)

  async function rollup(reason: string) {
    try {
      const { days, rows, purged } = await runTelemetryRollup(retentionDays)
      console.log(`[telemetry] rolled up ${rows} rows across ${days} day(s), purged ${purged} (${reason})`)
    } catch (e) {
      console.error(`[telemetry] rollup failed: ${(e as Error).message}`)
    }
  }

  // Reset any previous timer across dev HMR reloads.
  const g = globalThis as unknown as { __kvellmanTelemetryTimer?: ReturnType<typeof setInterval> }
  if (g.__kvellmanTelemetryTimer) clearInterval(g.__kvellmanTelemetryTimer)
  g.__kvellmanTelemetryTimer = setInterval(() => void rollup('scheduled'), 60 * 60 * 1000)
  g.__kvellmanTelemetryTimer.unref?.()
  console.log(`[telemetry] aggregator enabled: hourly, retention ${retentionDays}d`)

  // Roll up once at startup so the dashboard reflects events captured while the aggregator was down.
  void rollup('initial')
})
