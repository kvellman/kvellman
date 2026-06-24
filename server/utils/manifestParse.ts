import { parseAllDocuments } from 'yaml'
import {
  DEFAULT_MANIFEST_VERSION,
  MANIFEST_TYPES,
  MANIFEST_VERSIONS,
  type ManifestCreateInput,
  type ManifestType,
} from '#shared/manifest'
import { validateDoc } from './wingetSchemas'

function resolveManifestVersion(v: string): ManifestCreateInput['manifestVersion'] {
  return (MANIFEST_VERSIONS as readonly string[]).includes(v)
    ? (v as ManifestCreateInput['manifestVersion'])
    : DEFAULT_MANIFEST_VERSION
}

// Manifest validation pipeline: YAML parse (eemeli/yaml) → ManifestType/Version
// detection → ajv validation against bundled official schemas → identity consistency check →
// assemble into the structured ManifestCreateInput. Does NOT persist or re-hash.

export interface ParseError {
  path: string
  message: string
}
export class ManifestParseError extends Error {
  errors: ParseError[]
  constructor(errors: ParseError[]) {
    super('Manifest validation failed')
    this.name = 'ManifestParseError'
    this.errors = errors
  }
}

// YAML docs are arbitrary shapes; treat as loose records inside the parser.
/* eslint-disable @typescript-eslint/no-explicit-any */
type WingetDoc = Record<string, any>

// kvellman InstallerUrl placeholders ($REPO_URL, $SITE, …) are a documented extension and are
// rejected by the official schema's https URL pattern. Swap them for a dummy https URL in a
// clone used ONLY for ajv validation; assembly always reads the original doc.
function sanitizeForSchema(doc: WingetDoc): WingetDoc {
  const clone: WingetDoc = structuredClone(doc)
  for (const inst of Array.isArray(clone.Installers) ? clone.Installers : []) {
    if (typeof inst.InstallerUrl === 'string' && /\$[A-Z_]+/.test(inst.InstallerUrl)) {
      inst.InstallerUrl = 'https://placeholder.invalid/installer'
    }
  }
  return clone
}

function parseDocs(sources: string[]): WingetDoc[] {
  const docs: WingetDoc[] = []
  const errors: ParseError[] = []
  for (const src of sources) {
    for (const d of parseAllDocuments(src)) {
      if (d.errors.length) {
        errors.push(...d.errors.map((e) => ({ path: 'yaml', message: e.message })))
        continue
      }
      const obj = d.toJS()
      if (obj && typeof obj === 'object') docs.push(obj)
    }
  }
  if (errors.length) throw new ManifestParseError(errors)
  return docs
}

// Per-installer value with winget top-level fallback (winget lets many installer fields be
// declared once at the manifest root and inherited by each installer).
const pick = (i: WingetDoc, doc: WingetDoc, key: string): unknown => i[key] ?? doc[key] ?? null

function mapAppsAndFeatures(list: unknown): WingetDoc[] | null {
  if (!Array.isArray(list)) return null
  return list.map((e: WingetDoc) => ({
    displayName: e.DisplayName ?? null,
    publisher: e.Publisher ?? null,
    displayVersion: e.DisplayVersion ?? null,
    productCode: e.ProductCode ?? null,
    upgradeCode: e.UpgradeCode ?? null,
    installerType: e.InstallerType ?? null,
  }))
}
function mapDependencies(dep: unknown): WingetDoc | null {
  if (!dep || typeof dep !== 'object') return null
  const d = dep as WingetDoc
  return {
    windowsFeatures: d.WindowsFeatures ?? null,
    windowsLibraries: d.WindowsLibraries ?? null,
    externalDependencies: d.ExternalDependencies ?? null,
    packageDependencies: Array.isArray(d.PackageDependencies)
      ? d.PackageDependencies.map((p: WingetDoc) => ({
          packageIdentifier: p.PackageIdentifier,
          minimumVersion: p.MinimumVersion ?? null,
        }))
      : null,
  }
}

function mapInstallers(doc: WingetDoc): ManifestCreateInput['installers'] {
  const list: WingetDoc[] = Array.isArray(doc.Installers) ? doc.Installers : []
  return list.map((i) => ({
    architecture: i.Architecture,
    installerType: (i.InstallerType ?? doc.InstallerType) as ManifestCreateInput['installers'][number]['installerType'],
    installerUrl: i.InstallerUrl,
    installerSha256: i.InstallerSha256,
    scope: pick(i, doc, 'Scope') as never,
    installerSwitches: pick(i, doc, 'InstallerSwitches') as never,
    localFile: null,
    signatureSha256: (i.SignatureSha256 ?? null) as never,
    channel: pick(i, doc, 'Channel') as never,
    installerLocale: pick(i, doc, 'InstallerLocale') as never,
    minimumOsVersion: pick(i, doc, 'MinimumOSVersion') as never,
    nestedInstallerType: pick(i, doc, 'NestedInstallerType') as never,
    upgradeBehavior: pick(i, doc, 'UpgradeBehavior') as never,
    packageFamilyName: pick(i, doc, 'PackageFamilyName') as never,
    productCode: pick(i, doc, 'ProductCode') as never,
    releaseDate: pick(i, doc, 'ReleaseDate') as never,
    elevationRequirement: pick(i, doc, 'ElevationRequirement') as never,
    repairBehavior: pick(i, doc, 'RepairBehavior') as never,
    installerAbortsTerminal: pick(i, doc, 'InstallerAbortsTerminal') as never,
    installLocationRequired: pick(i, doc, 'InstallLocationRequired') as never,
    requireExplicitUpgrade: pick(i, doc, 'RequireExplicitUpgrade') as never,
    displayInstallWarnings: pick(i, doc, 'DisplayInstallWarnings') as never,
    downloadCommandProhibited: pick(i, doc, 'DownloadCommandProhibited') as never,
    archiveBinariesDependOnPath: pick(i, doc, 'ArchiveBinariesDependOnPath') as never,
    platform: pick(i, doc, 'Platform') as never,
    installModes: pick(i, doc, 'InstallModes') as never,
    commands: pick(i, doc, 'Commands') as never,
    protocols: pick(i, doc, 'Protocols') as never,
    fileExtensions: pick(i, doc, 'FileExtensions') as never,
    capabilities: pick(i, doc, 'Capabilities') as never,
    restrictedCapabilities: pick(i, doc, 'RestrictedCapabilities') as never,
    unsupportedOsArchitectures: pick(i, doc, 'UnsupportedOSArchitectures') as never,
    unsupportedArguments: pick(i, doc, 'UnsupportedArguments') as never,
    installerSuccessCodes: pick(i, doc, 'InstallerSuccessCodes') as never,
    appsAndFeaturesEntries: mapAppsAndFeatures(i.AppsAndFeaturesEntries ?? doc.AppsAndFeaturesEntries) as never,
    dependencies: mapDependencies(i.Dependencies ?? doc.Dependencies) as never,
    nestedInstallerFiles: pick(i, doc, 'NestedInstallerFiles') as never,
    expectedReturnCodes: pick(i, doc, 'ExpectedReturnCodes') as never,
    markets: pick(i, doc, 'Markets') as never,
    installationMetadata: pick(i, doc, 'InstallationMetadata') as never,
  }))
}

function mapLocale(doc: WingetDoc, isDefault: boolean): ManifestCreateInput['locales'][number] {
  return {
    packageLocale: doc.PackageLocale,
    packageName: doc.PackageName ?? null,
    publisher: doc.Publisher ?? null,
    shortDescription: doc.ShortDescription ?? null,
    license: doc.License ?? null,
    tags: Array.isArray(doc.Tags) ? doc.Tags.map(String) : [],
    moniker: doc.Moniker ?? null,
    isDefault,
    publisherUrl: doc.PublisherUrl ?? null,
    publisherSupportUrl: doc.PublisherSupportUrl ?? null,
    privacyUrl: doc.PrivacyUrl ?? null,
    author: doc.Author ?? null,
    packageUrl: doc.PackageUrl ?? null,
    licenseUrl: doc.LicenseUrl ?? null,
    copyright: doc.Copyright ?? null,
    copyrightUrl: doc.CopyrightUrl ?? null,
    description: doc.Description ?? null,
    releaseNotes: doc.ReleaseNotes ?? null,
    releaseNotesUrl: doc.ReleaseNotesUrl ?? null,
    purchaseUrl: doc.PurchaseUrl ?? null,
    installationNotes: doc.InstallationNotes ?? null,
    agreements: doc.Agreements ?? null,
    documentations: doc.Documentations ?? null,
    icons: doc.Icons ?? null,
  }
}

/**
 * Validate and assemble one or more YAML sources (singleton or multi-file) into a structured
 * create payload. Throws ManifestParseError with per-doc/field detail on any failure.
 */
export async function parseManifest(sources: string[]): Promise<ManifestCreateInput> {
  const docs = parseDocs(sources)
  if (docs.length === 0) {
    throw new ManifestParseError([{ path: '', message: 'No YAML documents found' }])
  }

  // 1. Classify + ajv-validate every document against its declared ManifestVersion's schema.
  const errors: ParseError[] = []
  const byType: Partial<Record<ManifestType, WingetDoc[]>> = {}
  for (const [i, doc] of docs.entries()) {
    const type = doc.ManifestType as string | undefined
    if (!type || !MANIFEST_TYPES.includes(type as ManifestType)) {
      errors.push({ path: `doc[${i}]`, message: `Missing or unknown ManifestType '${type}'` })
      continue
    }
    const mt = type as ManifestType
    const result = await validateDoc(mt, String(doc.ManifestVersion ?? ''), sanitizeForSchema(doc))
    if (!result.valid) {
      errors.push(...result.errors.map((e) => ({ path: mt + e.path, message: e.message })))
    }
    ;(byType[mt] ??= []).push(doc)
  }
  if (errors.length) throw new ManifestParseError(errors)

  // 2. Identity consistency across all docs.
  const ids = new Set(docs.map((d) => String(d.PackageIdentifier)))
  const versions = new Set(docs.map((d) => String(d.PackageVersion)))
  if (ids.size > 1) {
    errors.push({ path: 'PackageIdentifier', message: `Inconsistent: ${[...ids].join(', ')}` })
  }
  if (versions.size > 1) {
    errors.push({ path: 'PackageVersion', message: `Inconsistent: ${[...versions].join(', ')}` })
  }
  if (errors.length) throw new ManifestParseError(errors)

  // Declared schema version (resolved to a bundled one by validateDoc; stored as-is).
  const manifestVersion = resolveManifestVersion(String(docs[0]?.ManifestVersion ?? ''))

  // 3. Assemble.
  const singleton = byType.singleton?.[0]
  if (singleton) {
    return {
      packageIdentifier: singleton.PackageIdentifier,
      packageVersion: singleton.PackageVersion,
      manifestVersion,
      locales: [mapLocale(singleton, true)],
      installers: mapInstallers(singleton),
    }
  }

  // Multi-file: need an installer doc and a defaultLocale doc.
  const installerDoc = byType.installer?.[0]
  const defaultLocaleDoc = byType.defaultLocale?.[0]
  const identityDoc = byType.version?.[0] ?? installerDoc ?? defaultLocaleDoc
  if (!installerDoc) errors.push({ path: '', message: 'Missing installer manifest' })
  if (!defaultLocaleDoc) errors.push({ path: '', message: 'Missing defaultLocale manifest' })
  if (errors.length) throw new ManifestParseError(errors)

  const locales = [
    mapLocale(defaultLocaleDoc!, true),
    ...(byType.locale ?? []).map((l) => mapLocale(l, false)),
  ]
  return {
    packageIdentifier: identityDoc!.PackageIdentifier,
    packageVersion: identityDoc!.PackageVersion,
    manifestVersion,
    locales,
    installers: mapInstallers(installerDoc!),
  }
}
