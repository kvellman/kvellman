import { relations } from 'drizzle-orm'
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

// Manifest store. Mirrors the winget REST contract closely
// (StoredPackage/Version/Installer/Locale shapes).

export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  packageIdentifier: text('package_identifier').notNull().unique(),
  // Denormalised search fields (what manifestSearch matches against).
  packageName: text('package_name').notNull(),
  publisher: text('publisher').notNull(),
  moniker: text('moniker'),
  tags: text('tags').array().notNull().default([]),
  // Reusable overlay template: installer field overrides (values may contain $VERSION / $ARCH),
  // derived from an overlaid version and suggested when editing a new version.
  overlayTemplate: jsonb('overlay_template').$type<{
    sourceVersion?: string
    rules: { architecture: string; field: string; value: unknown }[]
  }>(),
})

export const versions = pgTable('versions', {
  id: serial('id').primaryKey(),
  packageId: integer('package_id')
    .notNull()
    .references(() => packages.id, { onDelete: 'cascade' }),
  packageVersion: text('package_version').notNull(),
  // Provenance of this version's manifest:
  //   'upstream' = unmodified manifest from an external source (e.g. winget-pkgs)
  //   'overlay'  = from an external source but with local customizations applied
  //   'local'    = own manifest, not derived from any external source
  origin: text('origin').$type<'upstream' | 'overlay' | 'local'>().notNull().default('local'),
  // Declared winget schema version (ManifestVersion) — drives spec validation.
  manifestVersion: text('manifest_version').notNull().default('1.9.0'),
  // Overlay only: the pristine upstream manifest captured when the overlay was first created
  // (shape { manifestVersion, locales, installers }). Enables the diff view and reset-to-upstream.
  upstreamSnapshot: jsonb('upstream_snapshot').$type<{
    manifestVersion: string
    locales: Record<string, unknown>[]
    installers: Record<string, unknown>[]
  }>(),
  // Review/approval gate (M4-B). Only 'approved' versions are delivered to winget clients; new
  // versions start 'pending' and editing/resetting reverts to 'pending' (content changed).
  approvalStatus: text('approval_status')
    .$type<'pending' | 'approved' | 'rejected'>()
    .notNull()
    .default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
})

export const installers = pgTable('installers', {
  id: serial('id').primaryKey(),
  versionId: integer('version_id')
    .notNull()
    .references(() => versions.id, { onDelete: 'cascade' }),
  architecture: text('architecture').notNull(),
  installerType: text('installer_type').notNull(),
  // May contain server-side placeholders ($REPO_URL, $SITE, $LOCATION, $LANG),
  // resolved at delivery and never exposed raw to the client.
  installerUrl: text('installer_url').notNull(),
  installerSha256: text('installer_sha256').notNull(),
  scope: text('scope'),
  installerSwitches: jsonb('installer_switches').$type<Record<string, string>>(),
  // If set and the site mirrors locally, the hash is recomputed from this file.
  localFile: text('local_file'),
  // --- Full winget installer spec fields (all optional, delivered verbatim) ---
  signatureSha256: text('signature_sha256'),
  channel: text('channel'),
  installerLocale: text('installer_locale'),
  minimumOsVersion: text('minimum_os_version'),
  nestedInstallerType: text('nested_installer_type'),
  upgradeBehavior: text('upgrade_behavior'),
  packageFamilyName: text('package_family_name'),
  productCode: text('product_code'),
  releaseDate: text('release_date'),
  elevationRequirement: text('elevation_requirement'),
  repairBehavior: text('repair_behavior'),
  installerAbortsTerminal: boolean('installer_aborts_terminal'),
  installLocationRequired: boolean('install_location_required'),
  requireExplicitUpgrade: boolean('require_explicit_upgrade'),
  displayInstallWarnings: boolean('display_install_warnings'),
  downloadCommandProhibited: boolean('download_command_prohibited'),
  archiveBinariesDependOnPath: boolean('archive_binaries_depend_on_path'),
  platform: text('platform').array(),
  installModes: text('install_modes').array(),
  commands: text('commands').array(),
  protocols: text('protocols').array(),
  fileExtensions: text('file_extensions').array(),
  capabilities: text('capabilities').array(),
  restrictedCapabilities: text('restricted_capabilities').array(),
  unsupportedOsArchitectures: text('unsupported_os_architectures').array(),
  unsupportedArguments: text('unsupported_arguments').array(),
  installerSuccessCodes: integer('installer_success_codes').array(),
  // Structured (editable) complex fields.
  appsAndFeaturesEntries: jsonb('apps_and_features_entries').$type<Record<string, unknown>[]>(),
  dependencies: jsonb('dependencies').$type<Record<string, unknown>>(),
  // Preserved-verbatim complex fields (round-trip, not form-edited yet).
  nestedInstallerFiles: jsonb('nested_installer_files').$type<Record<string, unknown>[]>(),
  expectedReturnCodes: jsonb('expected_return_codes').$type<Record<string, unknown>[]>(),
  markets: jsonb('markets').$type<Record<string, unknown>>(),
  installationMetadata: jsonb('installation_metadata').$type<Record<string, unknown>>(),
})

export const locales = pgTable('locales', {
  id: serial('id').primaryKey(),
  versionId: integer('version_id')
    .notNull()
    .references(() => versions.id, { onDelete: 'cascade' }),
  packageLocale: text('package_locale').notNull(),
  // Required by winget only in the defaultLocale file; nullable so additional `locale` files
  // (which may carry just PackageLocale) can be stored. Enforced for the default via localeSchema.
  publisher: text('publisher'),
  packageName: text('package_name'),
  shortDescription: text('short_description'),
  license: text('license'),
  tags: text('tags').array().notNull().default([]),
  moniker: text('moniker'),
  isDefault: boolean('is_default').notNull().default(false),
  // --- Full winget locale spec fields (all optional, delivered verbatim) ---
  publisherUrl: text('publisher_url'),
  publisherSupportUrl: text('publisher_support_url'),
  privacyUrl: text('privacy_url'),
  author: text('author'),
  packageUrl: text('package_url'),
  licenseUrl: text('license_url'),
  copyright: text('copyright'),
  copyrightUrl: text('copyright_url'),
  description: text('description'),
  releaseNotes: text('release_notes'),
  releaseNotesUrl: text('release_notes_url'),
  purchaseUrl: text('purchase_url'),
  installationNotes: text('installation_notes'),
  // Preserved-verbatim complex fields.
  agreements: jsonb('agreements').$type<Record<string, unknown>[]>(),
  documentations: jsonb('documentations').$type<Record<string, unknown>[]>(),
  icons: jsonb('icons').$type<Record<string, unknown>[]>(),
})

export const siteTokens = pgTable('site_tokens', {
  token: text('token').primaryKey(),
  site: text('site').notNull(),
  location: text('location').notNull(),
  defaultLocale: text('default_locale').notNull(),
  // Base URL / UNC root that $REPO_URL resolves to for this site.
  repoUrl: text('repo_url').notNull(),
  mirrorLocally: boolean('mirror_locally').notNull().default(false),
})

// Local user accounts (M5-A, Community auth). Passwords are scrypt-hashed via nuxt-auth-utils.
// `role` is carried now but enforced in M5-B (RBAC); the first account is created as 'admin' via
// the first-run setup flow.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // Null for external (SSO) accounts that have no local password.
  passwordHash: text('password_hash'),
  role: text('role').$type<'admin' | 'reviewer' | 'viewer'>().notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Edge/mirror nodes registered with this origin. An admin creates an entry which
// yields a one-time enrollment key; the node enrolls with it and receives a durable bearer token
// (only hashes are stored). Heartbeats update lastSeenAt. Revoking invalidates the token.
export const nodes = pgTable('nodes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').$type<'pending' | 'active' | 'revoked'>().notNull().default('pending'),
  enrollmentKeyHash: text('enrollment_key_hash').notNull(),
  tokenHash: text('token_hash'),
  // mTLS: SHA-256 fingerprint + expiry of the issued client certificate.
  certFingerprint: text('cert_fingerprint'),
  certNotAfter: timestamp('cert_not_after', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastInfo: jsonb('last_info').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }),
  // Package scope for this node's sync index. scopeAll=true → all approved packages; otherwise the
  // union of packages whose identifier is in scopePackages or whose tags intersect scopeTags.
  scopeAll: boolean('scope_all').notNull().default(true),
  scopePackages: text('scope_packages').array().notNull().default([]),
  scopeTags: text('scope_tags').array().notNull().default([]),
  // Installer filter (applies to both lazy caching and push). Empty = no restriction. A site is
  // usually homogeneous, so e.g. ['x64'] + ['machine'] avoids mirroring installers it never needs.
  filterArchitectures: text('filter_architectures').array().notNull().default([]),
  filterScopes: text('filter_scopes').array().notNull().default([]),
})

// Admin requests to pre-stage (push) a package version's installers onto a node. The origin resolves
// the installer URLs at request time; the node fetches them on its next heartbeat. A request is
// cleared once the node reports the version as mirrored.
export const nodeMirrorRequests = pgTable(
  'node_mirror_requests',
  {
    id: serial('id').primaryKey(),
    nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    packageIdentifier: text('package_identifier').notNull(),
    packageVersion: text('package_version').notNull(),
    urls: jsonb('urls').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.nodeId, t.packageIdentifier, t.packageVersion)],
)

// Admin requests to remove (evict) a mirrored version from a node, freeing space. The node deletes
// it on its next heartbeat; the request is cleared once the node no longer reports it as mirrored.
export const nodeCacheRemovals = pgTable(
  'node_cache_removals',
  {
    id: serial('id').primaryKey(),
    nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    packageIdentifier: text('package_identifier').notNull(),
    packageVersion: text('package_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.nodeId, t.packageIdentifier, t.packageVersion)],
)

// Per-user storage for plugins (e.g. an MFA secret). Namespaced by plugin so addons never collide.
export const pluginData = pgTable(
  'plugin_data',
  {
    plugin: text('plugin').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').$type<unknown>(),
  },
  (t) => [primaryKey({ columns: [t.plugin, t.userId, t.key] })],
)

// Generic key/value app settings (e.g. the Enterprise license token).
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Catalog of packages available upstream (synced from the winget index) — powers import search.
export const upstreamCatalog = pgTable('upstream_catalog', {
  packageIdentifier: text('package_identifier').primaryKey(),
  name: text('name').notNull(),
  moniker: text('moniker'),
  latestVersion: text('latest_version'),
})

// Audit log — one row per mutating action (manifest create/edit, …). Append-only.
export const auditEntries = pgTable('audit_entries', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  action: text('action').notNull(),
  // Who performed the action: a user's name/email, 'system' for scheduled jobs, or null (legacy).
  actor: text('actor'),
  packageIdentifier: text('package_identifier'),
  packageVersion: text('package_version'),
  detail: jsonb('detail').$type<Record<string, unknown>>(),
})

// Repository-usage telemetry — one row per winget client request we can observe (search,
// manifest fetch, installer download). winget pushes no install-success events, so these are the
// real signals: manifest.fetch = strong install intent, installer.download = actual download from
// our store. Append-only, high-volume; rolled up by the aggregator (telemetry_daily) and purged.
export const telemetryEvents = pgTable('telemetry_events', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  eventType: text('event_type').$type<'search' | 'manifest.fetch' | 'installer.download'>().notNull(),
  packageIdentifier: text('package_identifier'),
  packageVersion: text('package_version'),
  // Resolved site (from siteToken); null where unavailable (e.g. /dl carries no token).
  site: text('site'),
  // Parsed from the winget-cli User-Agent.
  wingetVersion: text('winget_version'),
  // Client source IP (gated by TELEMETRY_ENABLED; anonymization is a future config option).
  sourceIp: text('source_ip'),
})

// Daily rollup of telemetry_events — one row per (day × event type × package × version × site ×
// winget version) with a count. The aggregator recomputes the days that still have raw events, then
// raw events are purged after the retention window; these aggregates persist long-term and feed the
// dashboard cheaply.
export const telemetryDaily = pgTable(
  'telemetry_daily',
  {
    id: serial('id').primaryKey(),
    day: date('day').notNull(),
    eventType: text('event_type').$type<'search' | 'manifest.fetch' | 'installer.download'>().notNull(),
    packageIdentifier: text('package_identifier'),
    packageVersion: text('package_version'),
    site: text('site'),
    wingetVersion: text('winget_version'),
    count: integer('count').notNull(),
  },
  (t) => [index('telemetry_daily_day_idx').on(t.day)],
)

// Relations — enable nested fetching via db.query (used by packageManifests/[id]).
export const packagesRelations = relations(packages, ({ many }) => ({
  versions: many(versions),
}))

export const versionsRelations = relations(versions, ({ one, many }) => ({
  package: one(packages, { fields: [versions.packageId], references: [packages.id] }),
  installers: many(installers),
  locales: many(locales),
}))

export const installersRelations = relations(installers, ({ one }) => ({
  version: one(versions, { fields: [installers.versionId], references: [versions.id] }),
}))

export const localesRelations = relations(locales, ({ one }) => ({
  version: one(versions, { fields: [locales.versionId], references: [versions.id] }),
}))
