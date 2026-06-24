import { z } from 'zod'

// Shared manifest field validation — used by the edit form (Nuxt UI UForm) and the write API.
// Mirrors the winget manifest schema (1.9.0–1.12.x) constraints for the fields kvellman edits.
// (Nuxt UI's UForm consumes a Zod schema directly, which supersedes the originally-planned
// vee-validate layer now that the UI is committed to Nuxt UI v4.)

// winget enums + constraints (from the official v1.9.0 manifest schemas, bundled under
// server/schemas/winget/). Field length limits and the locale pattern mirror the spec exactly.
export const ARCHITECTURES = ['x86', 'x64', 'arm', 'arm64', 'neutral'] as const
// Per manifest.installer schema — note: 'msstore' is NOT a valid InstallerType here.
export const INSTALLER_TYPES = [
  'msix',
  'msi',
  'appx',
  'exe',
  'zip',
  'inno',
  'nullsoft',
  'wix',
  'burn',
  'pwa',
  'portable',
] as const
export const SCOPES = ['user', 'machine'] as const

// InstallerSwitches: the spec defines this fixed set of keys (additional keys are tolerated but
// non-standard). Values are length-bounded — Custom allows 2048, the rest 512.
export const SWITCH_KEYS = [
  'Silent',
  'SilentWithProgress',
  'Interactive',
  'InstallLocation',
  'Log',
  'Upgrade',
  'Repair',
  'Custom',
] as const
export type SwitchKey = (typeof SWITCH_KEYS)[number]

// Further installer enums (from manifest.installer).
export const NESTED_INSTALLER_TYPES = ['msix', 'msi', 'appx', 'exe', 'inno', 'nullsoft', 'wix', 'burn', 'portable'] as const
export const UPGRADE_BEHAVIORS = ['install', 'uninstallPrevious', 'deny'] as const
export const ELEVATION_REQUIREMENTS = ['elevationRequired', 'elevationProhibited', 'elevatesSelf'] as const
export const REPAIR_BEHAVIORS = ['modify', 'uninstaller', 'installer'] as const
export const PLATFORMS = ['Windows.Desktop', 'Windows.Universal'] as const
export const INSTALL_MODES = ['interactive', 'silent', 'silentWithProgress'] as const
export const UNSUPPORTED_ARCHS = ['x86', 'x64', 'arm', 'arm64'] as const
export const UNSUPPORTED_ARGS = ['log', 'location'] as const

// winget schema versions bundled under server/schemas/winget/ — keep newest first.
export const MANIFEST_VERSIONS = [
  '1.12.0',
  '1.10.0',
  '1.9.0',
  '1.7.0',
  '1.6.0',
  '1.5.0',
  '1.4.0',
  '1.2.0',
  '1.1.0',
  '1.0.0',
] as const
// Default for newly created manifests = the newest bundled version (first in the list above).
export const DEFAULT_MANIFEST_VERSION = MANIFEST_VERSIONS[0]

// BCP-47 language tag, e.g. en-US (manifest.defaultLocale → PackageLocale pattern).
const LOCALE_PATTERN = /^([a-zA-Z]{2,3}|[iI]-[a-zA-Z]+|[xX]-[a-zA-Z]{1,8})(-[a-zA-Z]{1,8})*$/

const nonEmpty = z.string().trim().min(1)
// Optional free-text/URL field: bounds length, allows '' (the form's empty value) and null.
// URL *format* is enforced by the ajv spec check against the official schema, not here, to keep
// empty optional inputs from failing form validation.
const optText = (max: number) => z.string().trim().max(max).optional().nullable()
const optStringArray = z.array(z.string()).optional().nullable()
// Verbatim passthrough for complex nested fields not yet form-modelled.
const passObjectArray = z.array(z.record(z.string(), z.unknown())).optional().nullable()
const passObject = z.record(z.string(), z.unknown()).optional().nullable()

// Structured complex fields (these two get a real editor).
export const appsAndFeaturesEntrySchema = z.object({
  displayName: optText(256),
  publisher: optText(256),
  displayVersion: optText(128),
  productCode: optText(255),
  upgradeCode: optText(255),
  installerType: z.enum(INSTALLER_TYPES).optional().nullable(),
})
export const packageDependencySchema = z.object({
  packageIdentifier: nonEmpty,
  minimumVersion: optText(128),
})
export const dependenciesSchema = z.object({
  windowsFeatures: optStringArray,
  windowsLibraries: optStringArray,
  externalDependencies: optStringArray,
  packageDependencies: z.array(packageDependencySchema).optional().nullable(),
})

// Fields the winget spec requires only in the defaultLocale manifest. Additional `locale` files
// (ManifestType: locale) legitimately carry just PackageLocale plus whatever they translate, so
// these are optional here and enforced for the default locale via superRefine below.
const DEFAULT_LOCALE_REQUIRED = ['packageName', 'publisher', 'shortDescription', 'license'] as const

export const localeSchema = z
  .object({
    packageLocale: z
      .string()
      .trim()
      .max(20)
      .regex(LOCALE_PATTERN, 'Must be a BCP-47 locale tag, e.g. en-US'),
    packageName: optText(256),
    publisher: optText(256),
    shortDescription: optText(256),
    // License is free text in the spec (not enumerated), bounded to 512 chars.
    license: optText(512),
    tags: z.array(z.string().trim().min(1).max(40)).default([]),
    moniker: z.string().trim().max(40).optional().nullable(),
    isDefault: z.boolean().default(false),
    // --- Full locale spec fields (optional) ---
    publisherUrl: optText(2048),
    publisherSupportUrl: optText(2048),
    privacyUrl: optText(2048),
    author: optText(256),
    packageUrl: optText(2048),
    licenseUrl: optText(2048),
    copyright: optText(512),
    copyrightUrl: optText(2048),
    description: optText(10000),
    releaseNotes: optText(10000),
    releaseNotesUrl: optText(2048),
    purchaseUrl: optText(2048),
    installationNotes: optText(10000),
    // Preserved verbatim.
    agreements: passObjectArray,
    documentations: passObjectArray,
    icons: passObjectArray,
  })
  .superRefine((v, ctx) => {
    if (!v.isDefault) return
    for (const field of DEFAULT_LOCALE_REQUIRED) {
      if (!v[field] || !String(v[field]).trim()) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Required for the default locale' })
      }
    }
  })

export const installerSchema = z.object({
  architecture: z.enum(ARCHITECTURES),
  installerType: z.enum(INSTALLER_TYPES),
  // May carry server-side placeholders ($REPO_URL, $SITE, $LOCATION, $LANG) — kept as-is here.
  installerUrl: nonEmpty,
  // SHA-256 hex (64 chars). Auto-recomputed on local mirror; validated for shape on input.
  installerSha256: z
    .string()
    .trim()
    .regex(/^[A-Fa-f0-9]{64}$/, 'Must be a 64-character SHA-256 hex string'),
  scope: z.enum(SCOPES).optional().nullable(),
  installerSwitches: z.record(z.string(), z.string().max(2048)).optional().nullable(),
  localFile: z.string().trim().optional().nullable(),
  // --- Full installer spec fields (optional) ---
  signatureSha256: z
    .string()
    .trim()
    .regex(/^([A-Fa-f0-9]{64})?$/, 'Must be a 64-character SHA-256 hex string')
    .optional()
    .nullable(),
  channel: optText(16),
  installerLocale: optText(20),
  minimumOsVersion: optText(128),
  nestedInstallerType: z.enum(NESTED_INSTALLER_TYPES).optional().nullable(),
  upgradeBehavior: z.enum(UPGRADE_BEHAVIORS).optional().nullable(),
  packageFamilyName: optText(255),
  productCode: optText(255),
  releaseDate: optText(20),
  elevationRequirement: z.enum(ELEVATION_REQUIREMENTS).optional().nullable(),
  repairBehavior: z.enum(REPAIR_BEHAVIORS).optional().nullable(),
  installerAbortsTerminal: z.boolean().optional().nullable(),
  installLocationRequired: z.boolean().optional().nullable(),
  requireExplicitUpgrade: z.boolean().optional().nullable(),
  displayInstallWarnings: z.boolean().optional().nullable(),
  downloadCommandProhibited: z.boolean().optional().nullable(),
  archiveBinariesDependOnPath: z.boolean().optional().nullable(),
  platform: z.array(z.enum(PLATFORMS)).optional().nullable(),
  installModes: z.array(z.enum(INSTALL_MODES)).optional().nullable(),
  commands: optStringArray,
  protocols: optStringArray,
  fileExtensions: optStringArray,
  capabilities: optStringArray,
  restrictedCapabilities: optStringArray,
  unsupportedOsArchitectures: z.array(z.enum(UNSUPPORTED_ARCHS)).optional().nullable(),
  unsupportedArguments: z.array(z.enum(UNSUPPORTED_ARGS)).optional().nullable(),
  installerSuccessCodes: z.array(z.number().int()).optional().nullable(),
  // Structured complex fields (editable).
  appsAndFeaturesEntries: z.array(appsAndFeaturesEntrySchema).optional().nullable(),
  dependencies: dependenciesSchema.optional().nullable(),
  // Preserved verbatim.
  nestedInstallerFiles: passObjectArray,
  expectedReturnCodes: passObjectArray,
  markets: passObject,
  installationMetadata: passObject,
})

// winget manifest file kinds (the ManifestType field), used when classifying uploaded docs.
export const MANIFEST_TYPES = [
  'singleton',
  'version',
  'installer',
  'defaultLocale',
  'locale',
] as const
export type ManifestType = (typeof MANIFEST_TYPES)[number]

const versionBody = z.object({
  locales: z.array(localeSchema).min(1, 'At least one locale is required'),
  installers: z.array(installerSchema).min(1, 'At least one installer is required'),
})
const exactlyOneDefaultLocale = (v: { locales: { isDefault: boolean }[] }) =>
  v.locales.filter((l) => l.isDefault).length === 1
const oneDefaultMessage = {
  message: 'Exactly one locale must be marked as default',
  path: ['locales'],
}

// PUT payload for editing a Custom (origin === 'local') version. packageVersion is the
// identity (carried in the URL) and is not editable here.
export const versionEditSchema = versionBody.refine(exactlyOneDefaultLocale, oneDefaultMessage)

// POST payload for creating a new manifest: the version body plus package identity.
export const manifestCreateSchema = versionBody
  .extend({
    // winget PackageIdentifier: dot-separated segments, e.g. Publisher.Package(.Sub…).
    packageIdentifier: z
      .string()
      .trim()
      .regex(/^[^\s.]+(\.[^\s.]+)+$/, 'Must be a dotted identifier, e.g. Publisher.Package'),
    packageVersion: z
      .string()
      .trim()
      .min(1)
      .regex(/^\S+$/, 'Version must not contain whitespace'),
    manifestVersion: z.enum(MANIFEST_VERSIONS).default(DEFAULT_MANIFEST_VERSION),
  })
  .refine(exactlyOneDefaultLocale, oneDefaultMessage)

export type LocaleInput = z.infer<typeof localeSchema>
export type InstallerInput = z.infer<typeof installerSchema>
export type VersionEditInput = z.infer<typeof versionBody>
export type ManifestCreateInput = z.infer<typeof manifestCreateSchema>
export type AppsAndFeaturesEntry = z.infer<typeof appsAndFeaturesEntrySchema>
export type Dependencies = z.infer<typeof dependenciesSchema>
