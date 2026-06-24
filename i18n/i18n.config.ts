// vue-i18n runtime config. Keys are the English source strings (gettext-style), so a flat
// messageResolver is used — otherwise vue-i18n would treat '.'/',' in the keys as nested paths.
// Missing translations fall back to English (the key itself).
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messageResolver: (obj: unknown, key: string) =>
    (obj as Record<string, string> | undefined)?.[key] ?? null,
}))
