// winget REST Source contract — the request/response shapes the winget client speaks. Derived from
// the public spec (microsoft/winget-cli-restsource); kvellman does not control it. These types are
// the part shared between the origin (this app) and a future edge/mirror node, and are the core of
// the publishable `@kvellman/winget-contract` package. Keep this file dependency-free.

// Every winget REST response wraps its payload in a Data envelope; search/manifests also paginate.
export interface WingetEnvelope<T> {
  Data: T
  ContinuationToken?: string | null
}

// GET /information
export interface SourceInformation {
  SourceIdentifier: string
  ServerSupportedVersions: string[]
  // Optional capability hints (auth, required/unsupported match fields, …).
  Authentication?: Record<string, unknown>
  RequiredPackageMatchFields?: string[]
  UnsupportedPackageMatchFields?: string[]
}

// winget MatchType semantics (see server/utils/match.ts for the SQL mapping).
export type MatchType =
  | 'Exact'
  | 'CaseInsensitive'
  | 'StartsWith'
  | 'Substring'
  | 'Wildcard'
  | 'Fuzzy'
  | 'FuzzySubstring'

export type PackageMatchField =
  | 'PackageIdentifier'
  | 'PackageName'
  | 'Moniker'
  | 'Publisher'
  | 'Tag'
  | 'Command'
  | 'PackageFamilyName'
  | 'ProductCode'

export interface RequestMatch {
  KeyWord?: string
  MatchType?: MatchType
}
export interface FieldMatch {
  PackageMatchField?: PackageMatchField | string
  RequestMatch?: RequestMatch
}

// POST /manifestSearch (top-level route — NOT under packageManifests).
export interface ManifestSearchRequest {
  MaximumResults?: number
  FetchAllManifests?: boolean
  Query?: RequestMatch
  Inclusions?: FieldMatch[]
  Filters?: FieldMatch[]
}

export interface SearchVersion {
  PackageVersion: string
  Channel?: string
  PackageFamilyNames?: string[]
  ProductCodes?: string[]
}
export interface SearchResult {
  PackageIdentifier: string
  PackageName: string
  Publisher: string
  Versions: SearchVersion[]
}
export type ManifestSearchResponse = WingetEnvelope<SearchResult[]>

// GET /packageManifests/{id} — the full, spec-compliant multi-locale/multi-installer manifest.
// Installer/locale fields are delivered verbatim; modeled loosely here (the origin is the producer).
export interface PackageManifestVersion {
  PackageVersion: string
  Channel?: string
  DefaultLocale?: Record<string, unknown>
  Locales?: Record<string, unknown>[]
  Installers?: Record<string, unknown>[]
}
export interface PackageManifest {
  PackageIdentifier: string
  Versions: PackageManifestVersion[]
}
export type PackageManifestResponse = WingetEnvelope<PackageManifest>
