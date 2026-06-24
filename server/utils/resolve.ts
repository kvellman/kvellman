import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { SiteContext } from '../services/sites'
import type { installers } from '../db/schema'
import { buildInstallerDoc } from './manifestYaml'
import { resolveStored } from '../services/storage'

// Server-side URL resolution and hash re-computing at delivery.
// The full installer manifest object is emitted (spec fidelity); the server-only localFile is
// dropped (not a winget field). Two cases:
//  • localFile set → the binary is hosted by kvellman: InstallerUrl points at our /dl origin
//    (using the request origin, not the site's $REPO_URL which is for site-local SMB/mirrors),
//    and InstallerSha256 is recomputed from the stored file.
//  • otherwise → resolve $REPO_URL/$SITE/$LOCATION/$LANG placeholders from the SiteContext.

type InstallerRow = typeof installers.$inferSelect

export async function resolveInstaller(
  installer: InstallerRow,
  ctx: SiteContext,
  lang: string,
  origin: string,
) {
  const doc = buildInstallerDoc(installer as unknown as Record<string, unknown>)

  if (installer.localFile) {
    const bytes = await readFile(resolveStored(installer.localFile))
    doc.InstallerSha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase()
    const encoded = installer.localFile.split('/').map(encodeURIComponent).join('/')
    doc.InstallerUrl = `${origin}/dl/${encoded}`
  } else if (typeof doc.InstallerUrl === 'string') {
    doc.InstallerUrl = doc.InstallerUrl.replaceAll('$REPO_URL', ctx.repoUrl)
      .replaceAll('$SITE', ctx.site)
      .replaceAll('$LOCATION', ctx.location)
      .replaceAll('$LANG', lang)
  }

  return doc
}
