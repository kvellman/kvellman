import { and, eq, inArray, or, type SQL } from 'drizzle-orm'
import { db } from '../../../db/client'
import { packages, versions } from '../../../db/schema'
import { matchCondition, tagMatchCondition, type MatchType } from '../../../utils/match'
import { resolveSite } from '../../../services/sites'
import { recordTelemetry } from '../../../utils/telemetry'

// POST /api/{siteToken}/manifestSearch — top-level search route (sibling to packageManifests,
// per the winget REST source contract).

interface RequestMatch {
  KeyWord?: string
  MatchType?: MatchType
}
interface FieldMatch {
  PackageMatchField?: string
  RequestMatch?: RequestMatch
}
interface SearchBody {
  MaximumResults?: number
  FetchAllManifests?: boolean
  Query?: RequestMatch
  Inclusions?: FieldMatch[]
  Filters?: FieldMatch[]
}

// Fields winget can match against → our denormalised package columns. 'Tag' is special-cased
// because it is a text[] array (see fieldCondition).
const FIELD_COLUMNS = {
  PackageIdentifier: packages.packageIdentifier,
  PackageName: packages.packageName,
  Moniker: packages.moniker,
  Publisher: packages.publisher,
} as const

// Build the SQL condition for a PackageMatchField, returning null for unknown fields.
function fieldCondition(field: string, keyword: string, matchType: MatchType): SQL | null {
  if (field === 'Tag') return tagMatchCondition(packages.tags, keyword, matchType)
  const col = FIELD_COLUMNS[field as keyof typeof FIELD_COLUMNS]
  return col ? matchCondition(col, keyword, matchType) : null
}

// A free-text Query matches if ANY of these common fields match (incl. Tag).
const QUERY_FIELDS = ['PackageIdentifier', 'PackageName', 'Moniker', 'Tag']

export default defineEventHandler(async (event) => {
  const body = (await readBody<SearchBody>(event)) ?? {}

  // Usage telemetry: a winget search request (no-op unless TELEMETRY_ENABLED).
  if (useRuntimeConfig().telemetryEnabled) {
    const ctx = await resolveSite(getRouterParam(event, 'siteToken') ?? '')
    recordTelemetry(event, { eventType: 'search', site: ctx.site })
  }

  const conditions: SQL[] = []

  // Free-text Query (the `winget search <term>` path).
  if (body.Query?.KeyWord) {
    const mt = body.Query.MatchType ?? 'CaseInsensitive'
    const ors = QUERY_FIELDS.map((f) => fieldCondition(f, body.Query!.KeyWord!, mt)).filter(
      (c): c is SQL => c !== null,
    )
    if (ors.length) conditions.push(or(...ors)!)
  }

  // Inclusions: at least one must match (OR).
  if (body.Inclusions?.length) {
    const ors = body.Inclusions
      .map((inc) =>
        inc.RequestMatch?.KeyWord
          ? fieldCondition(inc.PackageMatchField ?? '', inc.RequestMatch.KeyWord, inc.RequestMatch.MatchType ?? 'CaseInsensitive')
          : null,
      )
      .filter((c): c is SQL => c !== null)
    if (ors.length) conditions.push(or(...ors)!)
  }

  // Filters: all must match (AND).
  if (body.Filters?.length) {
    for (const flt of body.Filters) {
      if (!flt.RequestMatch?.KeyWord) continue
      const cond = fieldCondition(flt.PackageMatchField ?? '', flt.RequestMatch.KeyWord, flt.RequestMatch.MatchType ?? 'CaseInsensitive')
      if (cond) conditions.push(cond)
    }
  }

  // No criteria and not FetchAllManifests → match nothing.
  if (conditions.length === 0 && !body.FetchAllManifests) {
    return { Data: [], ContinuationToken: null }
  }

  const whereClause = conditions.length ? and(...conditions) : undefined
  const limit = body.MaximumResults && body.MaximumResults > 0 ? body.MaximumResults : 100

  const pkgRows = await db.select().from(packages).where(whereClause).limit(limit)
  if (pkgRows.length === 0) return { Data: [], ContinuationToken: null }

  const vRows = await db
    .select()
    .from(versions)
    .where(
      and(
        inArray(versions.packageId, pkgRows.map((p) => p.id)),
        // Approval gate: only approved versions are visible to winget clients (M4-B).
        eq(versions.approvalStatus, 'approved'),
      ),
    )
  const versionsByPkg = new Map<number, typeof vRows>()
  for (const v of vRows) {
    const arr = versionsByPkg.get(v.packageId) ?? []
    arr.push(v)
    versionsByPkg.set(v.packageId, arr)
  }

  return {
    // Exclude packages with no approved versions — winget expects each result to carry versions.
    Data: pkgRows
      .filter((p) => (versionsByPkg.get(p.id) ?? []).length > 0)
      .map((p) => ({
        PackageIdentifier: p.packageIdentifier,
        PackageName: p.packageName,
        Publisher: p.publisher,
        Versions: (versionsByPkg.get(p.id) ?? []).map((v) => ({
          PackageVersion: v.packageVersion,
          Channel: '',
          PackageFamilyNames: [],
          ProductCodes: [],
        })),
      })),
    ContinuationToken: null,
  }
})
