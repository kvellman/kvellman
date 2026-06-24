import { getEntitlements } from './license'

// Auth-provider extension point (open-core plugin API). A plugin (Nuxt module) calls
// registerAuthProvider() in a Nitro plugin at startup to add a login method (e.g. SSO). Providers
// may require an entitlement, so they only surface when licensed. The login page renders the
// enabled providers; each provider's own routes (login/callback) live in the plugin.
export interface AuthProvider {
  id: string
  label: string
  // Where the login button links to (the plugin's start route, e.g. /api/auth/oidc/login).
  startPath: string
  icon?: string
  // Entitlement required for this provider to be active (omit for open-core providers).
  entitlement?: string
}

const registry = new Map<string, AuthProvider>()

export function registerAuthProvider(p: AuthProvider): void {
  registry.set(p.id, p)
}

// Providers currently usable: registered AND (no entitlement OR entitlement active).
export async function enabledAuthProviders(): Promise<AuthProvider[]> {
  const ents = await getEntitlements()
  return [...registry.values()].filter((p) => !p.entitlement || ents.includes(p.entitlement))
}
