import type { InstallerInput, LocaleInput } from '#shared/manifest'
import { installers, locales } from '../db/schema'

// Mapping between the validated Zod input (camelCase, 1:1 with the DB column property names) and
// drizzle insert rows / API views. Centralised so the create + edit endpoints and the GET
// projection don't each repeat the full ~40-field installer / ~20-field locale list.

type InstallerRow = typeof installers.$inferSelect
type LocaleRow = typeof locales.$inferSelect

// Strip internal keys before insert — edit state carries `id`/`versionId` from the GET view, which
// must not flow into the new rows the editor inserts.
export function toInstallerInsert(versionId: number, i: InstallerInput): typeof installers.$inferInsert {
  const { id: _id, versionId: _v, ...rest } = i as Record<string, unknown>
  return { versionId, ...rest } as typeof installers.$inferInsert
}
export function toLocaleInsert(versionId: number, l: LocaleInput): typeof locales.$inferInsert {
  const { id: _id, versionId: _v, ...rest } = l as Record<string, unknown>
  return { versionId, ...rest } as typeof locales.$inferInsert
}

// API view: the stored row. Installers keep `id` (used to address binary uploads); both drop the
// internal `versionId`.
export function installerView(i: InstallerRow) {
  const { versionId: _v, ...rest } = i
  return rest
}
export function localeView(l: LocaleRow) {
  const { id: _id, versionId: _v, ...rest } = l
  return rest
}
