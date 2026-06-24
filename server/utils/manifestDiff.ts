/* eslint-disable @typescript-eslint/no-explicit-any */
// Field-level diff between two structured manifests (pristine upstream snapshot vs the effective,
// overlaid manifest). Drives the overlay "Customizations" view. Shape:
//   { manifestVersion?, locales: Row[], installers: Row[] }   (the editable/GET view shape)

export interface ManifestChange {
  field: string
  upstream: string
  overlay: string
}

type Row = Record<string, any>
interface Manifest {
  manifestVersion?: string
  locales?: Row[]
  installers?: Row[]
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return typeof v === 'string' ? v : JSON.stringify(v)
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

// Per-field diff of two matched objects (e.g. the same locale or installer), ignoring internal id.
function diffFields(label: string, up: Row, ov: Row, out: ManifestChange[]) {
  const keys = new Set([...Object.keys(up), ...Object.keys(ov)])
  for (const k of keys) {
    if (k === 'id') continue
    if (!equal(up[k], ov[k])) {
      out.push({ field: `${label}.${k}`, upstream: show(up[k]), overlay: show(ov[k]) })
    }
  }
}

function diffList(
  kind: string,
  keyOf: (r: Row) => string,
  up: Row[],
  ov: Row[],
  out: ManifestChange[],
) {
  const upMap = new Map(up.map((r) => [keyOf(r), r]))
  const ovMap = new Map(ov.map((r) => [keyOf(r), r]))
  for (const key of new Set([...upMap.keys(), ...ovMap.keys()])) {
    const u = upMap.get(key)
    const o = ovMap.get(key)
    const label = `${kind}[${key}]`
    if (u && !o) out.push({ field: label, upstream: '(present)', overlay: '(removed)' })
    else if (!u && o) out.push({ field: label, upstream: '(none)', overlay: '(added)' })
    else if (u && o) diffFields(label, u, o, out)
  }
}

export function diffManifest(upstream: Manifest, effective: Manifest): ManifestChange[] {
  const out: ManifestChange[] = []
  if (!equal(upstream.manifestVersion, effective.manifestVersion)) {
    out.push({
      field: 'manifestVersion',
      upstream: show(upstream.manifestVersion),
      overlay: show(effective.manifestVersion),
    })
  }
  diffList('locale', (l) => String(l.packageLocale), upstream.locales ?? [], effective.locales ?? [], out)
  diffList(
    'installer',
    (i) => `${i.architecture}/${i.installerType}`,
    upstream.installers ?? [],
    effective.installers ?? [],
    out,
  )
  return out
}
