import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { siteTokens } from '../db/schema'

// Site-Token resolution (priority order mTLS → Token → Subnet).
// The Token path (the robust primary) reads from the site_tokens table.
// mTLS and Subnet remain stubs.

export interface SiteContext {
  site: string
  location: string
  defaultLocale: string
  // Base URL / UNC root that $REPO_URL resolves to for this site.
  repoUrl: string
  // If true, installers are served from a mirrored local copy and re-hashed.
  mirrorLocally: boolean
}

export async function resolveSite(siteToken: string /*, event for mTLS/IP */): Promise<SiteContext> {
  // 1. mTLS client cert (Enterprise) — highest priority. STUB.
  // 2. Site-Token in URL path (primary, implemented):
  const row = await db.query.siteTokens.findFirst({
    where: eq(siteTokens.token, siteToken),
  })
  if (row) {
    return {
      site: row.site,
      location: row.location,
      defaultLocale: row.defaultLocale,
      repoUrl: row.repoUrl,
      mirrorLocally: row.mirrorLocally,
    }
  }
  // 3. Subnet / source-IP fallback. STUB.
  // Unknown token → safe default context.
  return {
    site: 'Unknown',
    location: 'Unknown',
    defaultLocale: 'en-US',
    repoUrl: 'http://localhost:3000',
    mirrorLocally: false,
  }
}
