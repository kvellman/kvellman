import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { DEFAULT_MANIFEST_VERSION, MANIFEST_VERSIONS, type ManifestType } from '#shared/manifest'

// ajv validation against the official winget JSON schemas, bundled under server/schemas/winget/
// (see scripts/fetch-winget-schemas.ts) and loaded as Nitro server assets — works air-gapped.
// validateDoc selects the schema set matching the manifest's declared ManifestVersion.

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
// winget schemas annotate int64 fields (e.g. InstallerReturnCode) with the non-standard format
// "long"; register it as a no-op so ajv doesn't warn on every compile.
ajv.addFormat('long', true)

const cache = new Map<string, ValidateFunction>()

export interface SchemaError {
  path: string
  message: string
}
export type ValidateResult =
  | { valid: true; version: string }
  | { valid: false; version: string; errors: SchemaError[] }

// Resolve the requested ManifestVersion to a bundled one: exact match, else the default.
function resolveVersion(manifestVersion: string): string {
  return (MANIFEST_VERSIONS as readonly string[]).includes(manifestVersion)
    ? manifestVersion
    : DEFAULT_MANIFEST_VERSION
}

async function loadValidator(version: string, type: ManifestType): Promise<ValidateFunction | null> {
  const key = `${version}:${type}`
  const cached = cache.get(key)
  if (cached) return cached
  const raw = await useStorage('assets:winget-schemas').getItem(
    `${version}/manifest.${type}.${version}.json`,
  )
  if (!raw) return null
  const schema = typeof raw === 'string' ? JSON.parse(raw) : raw
  const validate = ajv.compile(schema as object)
  cache.set(key, validate)
  return validate
}

export async function validateDoc(
  type: ManifestType,
  manifestVersion: string,
  doc: unknown,
): Promise<ValidateResult> {
  const version = resolveVersion(manifestVersion)
  const validate = await loadValidator(version, type)
  if (!validate) {
    return { valid: false, version, errors: [{ path: '', message: `No bundled schema for '${type}' ${version}` }] }
  }
  if (validate(doc)) return { valid: true, version }
  const errors = (validate.errors ?? []).map((e) => ({
    path: e.instancePath || '',
    message: `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`.trim(),
  }))
  return { valid: false, version, errors }
}
