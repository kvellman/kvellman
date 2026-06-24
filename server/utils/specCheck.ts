import type { ManifestType } from '#shared/manifest'
import { buildInstallerDoc, buildLocaleDoc, type VersionManifest } from './manifestYaml'
import { validateDoc } from './wingetSchemas'

// Automatic spec-compatibility check: validate a stored version against its declared
// ManifestVersion's official schemas (ajv). winget models a package as multi-file (version +
// installer + defaultLocale + locale) — and only multi-file allows >1 installer — so we validate
// each document against its own schema rather than the single-installer 'singleton' form.

export interface SpecCheckResult {
  valid: boolean
  version: string
  errors: { path: string; message: string }[]
}

// kvellman InstallerUrl placeholders are a documented extension the official schema rejects —
// swap them for a dummy https URL before validating.
function sanitizeInstaller(doc: Record<string, unknown>): Record<string, unknown> {
  if (typeof doc.InstallerUrl === 'string' && /\$[A-Z_]+/.test(doc.InstallerUrl)) {
    doc.InstallerUrl = 'https://placeholder.invalid/installer'
  }
  return doc
}

export async function checkVersionSpec(m: VersionManifest): Promise<SpecCheckResult> {
  const idv = { PackageIdentifier: m.packageIdentifier, PackageVersion: m.packageVersion }
  const mv = m.manifestVersion
  const def = m.locales.find((l) => l.isDefault) ?? m.locales[0]
  const others = m.locales.filter((l) => l !== def)

  const docs: { type: ManifestType; doc: Record<string, unknown> }[] = [
    { type: 'version', doc: { ...idv, DefaultLocale: def?.packageLocale ?? 'en-US', ManifestType: 'version', ManifestVersion: mv } },
    {
      type: 'installer',
      doc: { ...idv, Installers: m.installers.map((i) => sanitizeInstaller(buildInstallerDoc(i))), ManifestType: 'installer', ManifestVersion: mv },
    },
  ]
  if (def) {
    docs.push({ type: 'defaultLocale', doc: { ...idv, ...buildLocaleDoc(def), ManifestType: 'defaultLocale', ManifestVersion: mv } })
  }
  for (const l of others) {
    docs.push({ type: 'locale', doc: { ...idv, ...buildLocaleDoc(l), ManifestType: 'locale', ManifestVersion: mv } })
  }

  const errors: { path: string; message: string }[] = []
  let version = mv
  for (const { type, doc } of docs) {
    const r = await validateDoc(type, mv, doc)
    version = r.version
    if (!r.valid) errors.push(...r.errors.map((e) => ({ path: `${type}${e.path}`, message: e.message })))
  }
  return errors.length ? { valid: false, version, errors } : { valid: true, version, errors: [] }
}
