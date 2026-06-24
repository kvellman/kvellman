// Per-package overlay templates: which installer fields are customized, with values that may carry
// $VERSION / $ARCH placeholders so they adapt to each new version. Derived from an overlaid version
// (generalize) and applied when editing a new version (resolve).

export interface TemplateRule {
  architecture: string
  field: string
  value: unknown
}

// Version-/arch-specific fields are never templated (they must be recomputed per version).
const SKIP_FIELDS = new Set(['id', 'versionId', 'installerSha256', 'signatureSha256', 'localFile'])

function mapStrings(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === 'string') return fn(v)
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn))
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) o[k] = mapStrings(val, fn)
    return o
  }
  return v
}

// Replace concrete version/architecture occurrences with placeholders (when deriving a template).
export function generalizeValue(value: unknown, version: string, architecture: string): unknown {
  return mapStrings(value, (s) => {
    let r = s
    if (version) r = r.split(version).join('$VERSION')
    if (architecture) r = r.split(architecture).join('$ARCH')
    return r
  })
}

// Replace placeholders with concrete values (when applying a template to a version).
export function resolveValue(value: unknown, version: string, architecture: string): unknown {
  return mapStrings(value, (s) => s.split('$VERSION').join(version).split('$ARCH').join(architecture))
}

type Row = Record<string, unknown>

// Derive template rules from an overlaid version: the installer fields that differ from the pristine
// upstream snapshot, with concrete version/arch generalized to placeholders.
export function deriveTemplateRules(overlayInstallers: Row[], upstreamInstallers: Row[], version: string): TemplateRule[] {
  const upMap = new Map(upstreamInstallers.map((i) => [`${i.architecture}/${i.installerType}`, i]))
  const rules: TemplateRule[] = []
  for (const inst of overlayInstallers) {
    const up = upMap.get(`${inst.architecture}/${inst.installerType}`)
    for (const [field, val] of Object.entries(inst)) {
      if (SKIP_FIELDS.has(field)) continue
      if (val === null || val === undefined) continue
      if (JSON.stringify(up?.[field] ?? null) === JSON.stringify(val)) continue
      rules.push({
        architecture: String(inst.architecture),
        field,
        value: generalizeValue(val, version, String(inst.architecture)),
      })
    }
  }
  return rules
}
