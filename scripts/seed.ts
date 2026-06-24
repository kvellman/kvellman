import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { db } from '../server/db/client'
import { installers, locales, packages, siteTokens, versions } from '../server/db/schema'

// Seeds the 3 sample packages + 3 site tokens.
// Run with `pnpm db:seed`.

// Returns the single row from an `.returning()` insert (asserts it exists).
function firstRow<T>(rows: T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

async function seed() {
  // Reset (cascade deletes versions/installers/locales via FKs).
  await db.delete(packages)
  await db.delete(siteTokens)

  await db.insert(siteTokens).values([
    {
      token: 'munich-floor3',
      site: 'Munich',
      location: 'Floor3',
      defaultLocale: 'de-DE',
      // Site-local share. NOTE: whether winget downloads a UNC path is still open.
      repoUrl: 'http://localhost:3300/mirror/munich',
      mirrorLocally: true,
    },
    {
      token: 'berlin-hq',
      site: 'Berlin',
      location: 'HQ',
      defaultLocale: 'de-DE',
      repoUrl: 'http://localhost:3300/mirror/berlin',
      mirrorLocally: false,
    },
    {
      token: 't-7f93d2b1',
      site: 'Default',
      location: 'Default',
      defaultLocale: 'en-US',
      repoUrl: 'http://localhost:3300',
      mirrorLocally: false,
    },
  ])

  // Microsoft.PowerToys
  const pt = firstRow(
    await db
      .insert(packages)
      .values({
        packageIdentifier: 'Microsoft.PowerToys',
        packageName: 'PowerToys',
        publisher: 'Microsoft Corporation',
        moniker: 'powertoys',
        tags: ['utilities', 'windows', 'productivity'],
      })
      .returning(),
  )
  const ptv = firstRow(
    await db
      .insert(versions)
      .values({ packageId: pt.id, packageVersion: '0.81.0', origin: 'upstream' })
      .returning(),
  )
  await db.insert(installers).values({
    versionId: ptv.id,
    architecture: 'x64',
    installerType: 'exe',
    installerUrl:
      'https://github.com/microsoft/PowerToys/releases/download/v0.81.0/PowerToysSetup-0.81.0-x64.exe',
    installerSha256: 'A'.repeat(64),
    scope: 'machine',
    installerSwitches: { Silent: '/quiet' },
  })
  await db.insert(locales).values({
    versionId: ptv.id,
    packageLocale: 'en-US',
    publisher: 'Microsoft Corporation',
    packageName: 'PowerToys',
    shortDescription: 'Windows system utilities to maximize productivity.',
    license: 'MIT',
    tags: ['utilities', 'windows', 'productivity'],
    moniker: 'powertoys',
    isDefault: true,
  })

  // Mozilla.Firefox (demonstrates $LANG resolution)
  const ff = firstRow(
    await db
      .insert(packages)
      .values({
        packageIdentifier: 'Mozilla.Firefox',
        packageName: 'Mozilla Firefox',
        publisher: 'Mozilla',
        moniker: 'firefox',
        tags: ['browser', 'web', 'internet'],
      })
      .returning(),
  )
  const ffv = firstRow(
    await db
      .insert(versions)
      .values({
        packageId: ff.id,
        packageVersion: '127.0',
        origin: 'overlay',
        // Pristine upstream snapshot — differs from the effective rows below by the InstallerUrl
        // ($LANG templating is the local overlay customization), so the diff view shows it.
        upstreamSnapshot: {
          manifestVersion: '1.9.0',
          locales: [
            {
              packageLocale: 'en-US',
              publisher: 'Mozilla',
              packageName: 'Mozilla Firefox',
              shortDescription: 'Fast, private and secure web browser.',
              license: 'MPL-2.0',
              tags: ['browser', 'web', 'internet'],
              moniker: 'firefox',
              isDefault: true,
            },
          ],
          installers: [
            {
              architecture: 'x64',
              installerType: 'exe',
              installerUrl: 'https://download.mozilla.org/?product=firefox-127.0&os=win64&lang=en-US',
              installerSha256: 'B'.repeat(64),
              scope: 'machine',
            },
          ],
        },
      })
      .returning(),
  )
  await db.insert(installers).values({
    versionId: ffv.id,
    architecture: 'x64',
    installerType: 'exe',
    installerUrl: 'https://download.mozilla.org/?product=firefox-127.0&os=win64&lang=$LANG',
    installerSha256: 'B'.repeat(64),
    scope: 'machine',
  })
  await db.insert(locales).values({
    versionId: ffv.id,
    packageLocale: 'en-US',
    publisher: 'Mozilla',
    packageName: 'Mozilla Firefox',
    shortDescription: 'Fast, private and secure web browser.',
    license: 'MPL-2.0',
    tags: ['browser', 'web', 'internet'],
    moniker: 'firefox',
    isDefault: true,
  })

  // Contoso.InternalTool (demonstrates $REPO_URL placeholder + local mirror + re-hash)
  const ci = firstRow(
    await db
      .insert(packages)
      .values({
        packageIdentifier: 'Contoso.InternalTool',
        packageName: 'Contoso Internal Tool',
        publisher: 'Contoso',
        moniker: 'internaltool',
        tags: ['internal', 'lob', 'contoso'],
      })
      .returning(),
  )
  const civ = firstRow(
    await db
      .insert(versions)
      .values({ packageId: ci.id, packageVersion: '1.0.0', origin: 'local' })
      .returning(),
  )
  // Materialize the demo installer binary into the local origin store so it is served from /dl.
  const storeRoot = resolve(process.cwd(), process.env.INSTALLER_STORE ?? './data/installers')
  const civLocalFile = 'Contoso.InternalTool/1.0.0/fake-installer.bin'
  const civAbs = resolve(storeRoot, civLocalFile)
  await mkdir(dirname(civAbs), { recursive: true })
  await copyFile(resolve(process.cwd(), 'scripts/fixtures/fake-installer.bin'), civAbs)
  const civSha = createHash('sha256').update(await readFile(civAbs)).digest('hex').toUpperCase()
  await db.insert(installers).values({
    versionId: civ.id,
    architecture: 'x64',
    installerType: 'exe',
    installerUrl: '$REPO_URL/contoso/internaltool/1.0.0/setup.exe',
    installerSha256: civSha,
    localFile: civLocalFile,
    scope: 'machine',
    installerSwitches: { Silent: '/S' },
  })
  await db.insert(locales).values({
    versionId: civ.id,
    packageLocale: 'en-US',
    publisher: 'Contoso',
    packageName: 'Contoso Internal Tool',
    shortDescription: 'Line-of-business tool distributed from a site-local share.',
    license: 'Proprietary',
    tags: ['internal', 'lob', 'contoso'],
    moniker: 'internaltool',
    isDefault: true,
  })

  console.log('Seed complete: 3 packages, 3 site tokens.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
