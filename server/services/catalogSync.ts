import { unzipSync } from 'fflate'
import initSqlJs, { type SqlJsStatic } from 'sql.js'

// Downloads the prebuilt winget index (source2.msix, a ZIP containing Public/index.db, a SQLite
// catalog) and extracts the denormalized `packages` table → the importable-package catalog. Used by
// the manual sync endpoint (and, later, a scheduled worker). Network-dependent.

const INDEX_URL = 'https://cdn.winget.microsoft.com/cache/source2.msix'

export interface CatalogRow {
  packageIdentifier: string
  name: string
  moniker: string | null
  latestVersion: string | null
}

let sqlJs: SqlJsStatic | null = null
async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    const wasmBinary = (await useStorage('assets:sqljs').getItemRaw('sql-wasm.wasm')) as Uint8Array
    // sql.js accepts a TypedArray at runtime; the typings only declare ArrayBuffer.
    sqlJs = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer })
  }
  return sqlJs
}

export async function fetchUpstreamCatalog(): Promise<CatalogRow[]> {
  let msix: ArrayBuffer
  try {
    msix = await $fetch<ArrayBuffer>(INDEX_URL, { responseType: 'arrayBuffer' })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Cannot download the winget index' })
  }

  const entries = unzipSync(new Uint8Array(msix))
  const dbBytes = entries['Public/index.db']
  if (!dbBytes) {
    throw createError({ statusCode: 502, statusMessage: 'index.db not found in the winget index' })
  }

  const SQL = await getSqlJs()
  const database = new SQL.Database(dbBytes)
  try {
    const result = database.exec('SELECT id, name, moniker, latest_version FROM packages')
    if (result.length === 0) return []
    return result[0]!.values.map((r) => ({
      packageIdentifier: String(r[0]),
      name: r[1] != null ? String(r[1]) : String(r[0]),
      moniker: r[2] != null ? String(r[2]) : null,
      latestVersion: r[3] != null ? String(r[3]) : null,
    }))
  } finally {
    database.close()
  }
}
