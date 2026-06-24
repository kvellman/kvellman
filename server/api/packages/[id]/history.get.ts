import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client'
import { auditEntries } from '../../../db/schema'

// GET /api/packages/{id}/history[?version=...] — change history for a package (or a single version),
// derived from the audit log scoped to this package. Any authenticated user may view it; the global
// audit log stays admin-only.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = getQuery(event).version
  const wantVersion = typeof version === 'string' && version.trim() ? version.trim() : null

  const conds: SQL[] = [sql`lower(${auditEntries.packageIdentifier}) = lower(${id})`]
  if (wantVersion) conds.push(eq(auditEntries.packageVersion, wantVersion))

  const entries = await db
    .select({
      id: auditEntries.id,
      createdAt: auditEntries.createdAt,
      action: auditEntries.action,
      actor: auditEntries.actor,
      packageVersion: auditEntries.packageVersion,
      detail: auditEntries.detail,
    })
    .from(auditEntries)
    .where(and(...conds))
    .orderBy(desc(auditEntries.createdAt))
    .limit(100)

  return { count: entries.length, entries }
})
