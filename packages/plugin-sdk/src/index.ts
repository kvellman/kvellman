// SDK for kvellman plugins (Nuxt modules): shared types. The host runtime helpers are imported from
// the `#kvellman` alias — a plugin declares that ambient module once (see README) using these types.

export interface AuthProvider {
  /** Stable id, e.g. "oidc". */
  id: string
  /** Button label shown on the login page, e.g. "SSO". */
  label: string
  /** Route the login button links to (the plugin's start route), e.g. "/api/auth/oidc/login". */
  startPath: string
  /** Optional icon name. */
  icon?: string
  /** Entitlement required for this provider to be active (e.g. "sso"). */
  entitlement?: string
}

export interface SessionUser {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'reviewer' | 'viewer'
}
