import { and, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm'
import { db } from '../db/client'
import { auditEntries } from '../db/schema'
import { requireRole } from '../utils/authz'

// GET /api/audit — append-only audit log (admin only). Filters (all optional, combined with AND):
//   action     exact action (from the dropdown)
//   actionq    substring match on the action (free-text search)
//   actor      substring match on the actor
//   q          substring match on the package identifier
//   from/to    inclusive date range (YYYY-MM-DD, interpreted as UTC day boundaries)
// Also returns the full distinct action list (unfiltered) so the UI can populate the dropdown.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const query = getQuery(event)
  const str = (k: string) => (typeof query[k] === 'string' ? (query[k] as string).trim() : '')
  const action = str('action')
  const actionq = str('actionq')
  const actor = str('actor')
  const q = str('q')
  const from = str('from')
  const to = str('to')
  const limit = Math.min(Number(query.limit) || 200, 500)

  const conds: SQL[] = []
  if (action) conds.push(eq(auditEntries.action, action))
  if (actionq) conds.push(ilike(auditEntries.action, `%${actionq}%`))
  if (actor) conds.push(ilike(auditEntries.actor, `%${actor}%`))
  if (q) conds.push(ilike(auditEntries.packageIdentifier, `%${q}%`))
  // Date range on the day boundaries (UTC); guards against invalid input.
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null
  if (fromDate && !Number.isNaN(fromDate.getTime())) conds.push(gte(auditEntries.createdAt, fromDate))
  if (toDate && !Number.isNaN(toDate.getTime())) conds.push(lte(auditEntries.createdAt, toDate))

  const [entries, actionRows] = await Promise.all([
    db
      .select({
        id: auditEntries.id,
        createdAt: auditEntries.createdAt,
        action: auditEntries.action,
        actor: auditEntries.actor,
        packageIdentifier: auditEntries.packageIdentifier,
        packageVersion: auditEntries.packageVersion,
        detail: auditEntries.detail,
      })
      .from(auditEntries)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(auditEntries.createdAt))
      .limit(limit),
    db
      .selectDistinct({ action: auditEntries.action })
      .from(auditEntries)
      .orderBy(auditEntries.action),
  ])

  return { count: entries.length, entries, actions: actionRows.map((r) => r.action) }
})
