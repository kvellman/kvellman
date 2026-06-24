// Stable host API for plugins, exposed under the `#kvellman` alias (see nuxt.config nitro.alias).
// Plugins (separate packages) import from '#kvellman' instead of relying on auto-imports, which do
// not reach pre-built dependency code. Types live in @kvellman/plugin-sdk.
export { registerAuthProvider } from './authProviders'
export { findOrCreateUser, startUserSession } from './pluginAuth'
export { hasEntitlement, requireEntitlement } from './license'
export { deletePluginData, getPluginData, setPluginData } from './pluginStore'
export { getSessionFlag, getSessionUser, setSessionFlag } from './pluginSession'
export type { AuthProvider } from './authProviders'
export type { SessionUser } from './pluginAuth'
