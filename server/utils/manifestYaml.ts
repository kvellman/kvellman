import { stringify } from 'yaml'

// Builds a winget singleton-manifest representation from a stored version (admin/source view).
// `buildSingletonDoc` returns the PascalCase JS object (full field fidelity); the raw-view YAML
// and the spec check both consume it. This is the RAW stored manifest: placeholders intact,
// stored hash. Internal-only fields (localFile, isDefault) are omitted.

type Row = Record<string, unknown>
export interface VersionManifest {
  packageIdentifier: string
  packageVersion: string
  manifestVersion: string
  installers: Row[]
  locales: Row[]
}

function addIf(obj: Row, key: string, val: unknown) {
  if (val === null || val === undefined) return
  if (Array.isArray(val) && val.length === 0) return
  if (typeof val === 'string' && val === '') return
  obj[key] = val
}

// camelCase column → winget PascalCase manifest key.
const LOCALE_MAP: [string, string][] = [
  ['packageLocale', 'PackageLocale'],
  ['publisher', 'Publisher'],
  ['publisherUrl', 'PublisherUrl'],
  ['publisherSupportUrl', 'PublisherSupportUrl'],
  ['privacyUrl', 'PrivacyUrl'],
  ['author', 'Author'],
  ['packageName', 'PackageName'],
  ['packageUrl', 'PackageUrl'],
  ['license', 'License'],
  ['licenseUrl', 'LicenseUrl'],
  ['copyright', 'Copyright'],
  ['copyrightUrl', 'CopyrightUrl'],
  ['shortDescription', 'ShortDescription'],
  ['description', 'Description'],
  ['moniker', 'Moniker'],
  ['tags', 'Tags'],
  ['releaseNotes', 'ReleaseNotes'],
  ['releaseNotesUrl', 'ReleaseNotesUrl'],
  ['purchaseUrl', 'PurchaseUrl'],
  ['installationNotes', 'InstallationNotes'],
  ['agreements', 'Agreements'],
  ['documentations', 'Documentations'],
  ['icons', 'Icons'],
]

const INSTALLER_MAP: [string, string][] = [
  ['architecture', 'Architecture'],
  ['installerType', 'InstallerType'],
  ['installerUrl', 'InstallerUrl'],
  ['installerSha256', 'InstallerSha256'],
  ['signatureSha256', 'SignatureSha256'],
  ['scope', 'Scope'],
  ['installerSwitches', 'InstallerSwitches'],
  ['channel', 'Channel'],
  ['installerLocale', 'InstallerLocale'],
  ['minimumOsVersion', 'MinimumOSVersion'],
  ['nestedInstallerType', 'NestedInstallerType'],
  ['upgradeBehavior', 'UpgradeBehavior'],
  ['packageFamilyName', 'PackageFamilyName'],
  ['productCode', 'ProductCode'],
  ['releaseDate', 'ReleaseDate'],
  ['elevationRequirement', 'ElevationRequirement'],
  ['repairBehavior', 'RepairBehavior'],
  ['installerAbortsTerminal', 'InstallerAbortsTerminal'],
  ['installLocationRequired', 'InstallLocationRequired'],
  ['requireExplicitUpgrade', 'RequireExplicitUpgrade'],
  ['displayInstallWarnings', 'DisplayInstallWarnings'],
  ['downloadCommandProhibited', 'DownloadCommandProhibited'],
  ['archiveBinariesDependOnPath', 'ArchiveBinariesDependOnPath'],
  ['platform', 'Platform'],
  ['installModes', 'InstallModes'],
  ['commands', 'Commands'],
  ['protocols', 'Protocols'],
  ['fileExtensions', 'FileExtensions'],
  ['capabilities', 'Capabilities'],
  ['restrictedCapabilities', 'RestrictedCapabilities'],
  ['unsupportedOsArchitectures', 'UnsupportedOSArchitectures'],
  ['unsupportedArguments', 'UnsupportedArguments'],
  ['installerSuccessCodes', 'InstallerSuccessCodes'],
  ['nestedInstallerFiles', 'NestedInstallerFiles'],
  ['expectedReturnCodes', 'ExpectedReturnCodes'],
  ['markets', 'Markets'],
  ['installationMetadata', 'InstallationMetadata'],
]

function aafToPascal(list: unknown): Row[] | undefined {
  if (!Array.isArray(list)) return undefined
  return list.map((e: Row) => {
    const o: Row = {}
    addIf(o, 'DisplayName', e.displayName)
    addIf(o, 'Publisher', e.publisher)
    addIf(o, 'DisplayVersion', e.displayVersion)
    addIf(o, 'ProductCode', e.productCode)
    addIf(o, 'UpgradeCode', e.upgradeCode)
    addIf(o, 'InstallerType', e.installerType)
    return o
  })
}
function depsToPascal(dep: unknown): Row | undefined {
  if (!dep || typeof dep !== 'object') return undefined
  const d = dep as Row
  const o: Row = {}
  addIf(o, 'WindowsFeatures', d.windowsFeatures)
  addIf(o, 'WindowsLibraries', d.windowsLibraries)
  addIf(o, 'ExternalDependencies', d.externalDependencies)
  if (Array.isArray(d.packageDependencies)) {
    o.PackageDependencies = (d.packageDependencies as Row[]).map((p) => {
      const x: Row = { PackageIdentifier: p.packageIdentifier }
      addIf(x, 'MinimumVersion', p.minimumVersion)
      return x
    })
  }
  return Object.keys(o).length ? o : undefined
}

// One installer as a full PascalCase winget object (camelCase columns → spec keys).
export function buildInstallerDoc(i: Row): Row {
  const o: Row = {}
  for (const [camel, pascal] of INSTALLER_MAP) addIf(o, pascal, i[camel])
  addIf(o, 'AppsAndFeaturesEntries', aafToPascal(i.appsAndFeaturesEntries))
  addIf(o, 'Dependencies', depsToPascal(i.dependencies))
  return o
}

// One locale as a full PascalCase winget object.
export function buildLocaleDoc(l: Row): Row {
  const o: Row = {}
  for (const [camel, pascal] of LOCALE_MAP) addIf(o, pascal, l[camel])
  return o
}

// The full PascalCase singleton document (default locale fields at root).
export function buildSingletonDoc(m: VersionManifest): Row {
  const def = m.locales.find((l) => l.isDefault) ?? m.locales[0]
  const doc: Row = {
    PackageIdentifier: m.packageIdentifier,
    PackageVersion: m.packageVersion,
  }
  if (def) Object.assign(doc, buildLocaleDoc(def))
  doc.Installers = m.installers.map(buildInstallerDoc)
  doc.ManifestType = 'singleton'
  doc.ManifestVersion = m.manifestVersion
  return doc
}

export function buildSingletonYaml(m: VersionManifest): string {
  return stringify(buildSingletonDoc(m), { lineWidth: 0 })
}
