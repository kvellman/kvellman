import { asc } from 'drizzle-orm'
import { db } from '../db/client'
import { siteTokens } from '../db/schema'

// GET /api/site-tokens — configured site tokens. Used by the instructions page (token/site/location)
// and the admin management page (all fields). Authenticated; mutations are admin-only.
export default defineEventHandler(async () => {
  return db
    .select({
      token: siteTokens.token,
      site: siteTokens.site,
      location: siteTokens.location,
      defaultLocale: siteTokens.defaultLocale,
      repoUrl: siteTokens.repoUrl,
      mirrorLocally: siteTokens.mirrorLocally,
    })
    .from(siteTokens)
    .orderBy(asc(siteTokens.site))
})
