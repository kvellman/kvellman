// Manifest provenance → UI label, badge colour, and tooltip.
// Shared by the package overview and the per-version detail page.
// Labels are deliberately distinct (Original / Modified / Custom) so they never blur together.
export type Origin = 'upstream' | 'overlay' | 'local'

export interface OriginMeta {
  label: string
  color: 'neutral' | 'warning' | 'info'
  hint: string
}

export function originMeta(origin: string): OriginMeta {
  switch (origin) {
    case 'upstream':
      return { label: 'Original', color: 'neutral', hint: 'Unmodified upstream manifest' }
    case 'overlay':
      return { label: 'Modified', color: 'warning', hint: 'Upstream manifest with local changes' }
    default:
      return { label: 'Custom', color: 'info', hint: 'Own manifest, no external source' }
  }
}
