import { eq, ilike, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { MatchType } from '@kvellman/winget-contract'

// winget MatchType semantics (from the shared contract), mapped to real PostgreSQL conditions.
export type { MatchType }

// Escape LIKE metacharacters so user input is treated literally.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

export function matchCondition(column: PgColumn, keyword: string, matchType: MatchType): SQL {
  switch (matchType) {
    case 'Exact':
      return eq(column, keyword)
    case 'CaseInsensitive':
      return sql`lower(${column}) = lower(${keyword})`
    case 'StartsWith':
      return ilike(column, `${escapeLike(keyword)}%`)
    case 'Substring':
      return ilike(column, `%${escapeLike(keyword)}%`)
    case 'Wildcard':
      // winget '*' wildcard → SQL ILIKE '%'.
      return ilike(column, keyword.replace(/\*/g, '%'))
    case 'Fuzzy':
    case 'FuzzySubstring':
      // pg_trgm similarity (GIN trigram index on the searched columns).
      return sql`similarity(${column}, ${keyword}) > 0.3`
    default:
      return sql`false`
  }
}

// Tag matching against a text[] column: matches if ANY array element satisfies the match type.
export function tagMatchCondition(column: PgColumn, keyword: string, matchType: MatchType): SQL {
  const exists = (cond: SQL) => sql`exists (select 1 from unnest(${column}) as tag where ${cond})`
  switch (matchType) {
    case 'Exact':
      return exists(sql`tag = ${keyword}`)
    case 'CaseInsensitive':
      return exists(sql`lower(tag) = lower(${keyword})`)
    case 'StartsWith':
      return exists(sql`tag ilike ${`${escapeLike(keyword)}%`}`)
    case 'Substring':
      return exists(sql`tag ilike ${`%${escapeLike(keyword)}%`}`)
    case 'Wildcard':
      return exists(sql`tag ilike ${keyword.replace(/\*/g, '%')}`)
    case 'Fuzzy':
    case 'FuzzySubstring':
      return exists(sql`similarity(tag, ${keyword}) > 0.3`)
    default:
      return sql`false`
  }
}
