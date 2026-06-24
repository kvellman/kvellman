import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { installers, telemetryEvents, versions } from '../db/schema'

// Repository-usage telemetry. winget exposes no install-success callback, so we record the requests
// we can actually observe at the source API. Capture is fire-and-forget: it must never block or
// fail the winget response. Disabled unless TELEMETRY_ENABLED=true.

type EventType = 'search' | 'manifest.fetch' | 'installer.download'

interface RecordInput {
  eventType: EventType
  packageIdentifier?: string | null
  packageVersion?: string | null
  site?: string | null
}

// Extract the winget client version from the User-Agent, e.g.
//   "winget-cli WindowsPackageManager/1.6.3482 ..." → "1.6.3482"
//   "winget-cli/1.6.3482"                            → "1.6.3482"
export function parseWingetVersion(ua: string | undefined): string | null {
  if (!ua) return null
  const m =
    ua.match(/WindowsPackageManager\/(\d+\.\d+(?:\.\d+)*)/i) ??
    ua.match(/winget-cli\/(\d+\.\d+(?:\.\d+)*)/i)
  return m?.[1] ?? null
}

// Fire-and-forget: schedule the insert, swallow/log errors, never await in the request path.
export function recordTelemetry(event: H3Event, input: RecordInput): void {
  if (!useRuntimeConfig().telemetryEnabled) return

  const wingetVersion = parseWingetVersion(getHeader(event, 'user-agent'))
  const sourceIp = getRequestIP(event, { xForwardedFor: true }) ?? null

  void db
    .insert(telemetryEvents)
    .values({
      eventType: input.eventType,
      packageIdentifier: input.packageIdentifier ?? null,
      packageVersion: input.packageVersion ?? null,
      site: input.site ?? null,
      wingetVersion,
      sourceIp,
    })
    .catch((err) => {
      console.error('[telemetry] failed to record event', err)
    })
}

// Installer download from our local store. The /dl route carries only the file path (no siteToken),
// so we resolve package/version from the installer row by its stored localFile. Fire-and-forget;
// the UA is captured synchronously before the response detaches.
export function recordInstallerDownload(event: H3Event, localFile: string): void {
  if (!useRuntimeConfig().telemetryEnabled) return

  const wingetVersion = parseWingetVersion(getHeader(event, 'user-agent'))
  const sourceIp = getRequestIP(event, { xForwardedFor: true }) ?? null

  void (async () => {
    const row = await db
      .select({ packageVersion: versions.packageVersion, packageId: versions.packageId })
      .from(installers)
      .innerJoin(versions, eq(installers.versionId, versions.id))
      .where(eq(installers.localFile, localFile))
      .limit(1)
    const pkg = await db.query.packages.findFirst({
      where: (p, { eq: eqp }) => eqp(p.id, row[0]?.packageId ?? -1),
      columns: { packageIdentifier: true },
    })
    await db.insert(telemetryEvents).values({
      eventType: 'installer.download',
      packageIdentifier: pkg?.packageIdentifier ?? null,
      packageVersion: row[0]?.packageVersion ?? null,
      site: null,
      wingetVersion,
      sourceIp,
    })
  })().catch((err) => {
    console.error('[telemetry] failed to record installer download', err)
  })
}
