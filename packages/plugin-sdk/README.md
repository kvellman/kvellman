# @kvellman/plugin-sdk

SDK for building [kvellman](https://www.npmjs.com/package/@kvellman/winget-contract) plugins. A
plugin is a Nuxt module that extends the open-core app — e.g. adding a login method (SSO) — and is
gated by a license entitlement.

```ts
// In a Nitro plugin shipped by your module:
export default defineNitroPlugin(() => {
  registerAuthProvider({ id: 'oidc', label: 'SSO', startPath: '/api/auth/oidc/login', entitlement: 'sso' })
})

// In your callback route, after verifying the external identity:
const user = await findOrCreateUser(email, { name })
await startUserSession(event, user)
```

The runtime helpers live in the host and are imported from the **`#kvellman`** alias (which the host
maps to its implementation). Declare that ambient module once in your plugin so it compiles
standalone:

```ts
// types/kvellman.d.ts — a script file (no top-level import/export)
declare module '#kvellman' {
  import type { H3Event } from 'h3'
  import type { AuthProvider, SessionUser } from '@kvellman/plugin-sdk'
  export function registerAuthProvider(provider: AuthProvider): void
  export function findOrCreateUser(email: string, opts?: { name?: string | null }): Promise<SessionUser>
  export function startUserSession(event: H3Event, user: SessionUser): Promise<void>
  export function hasEntitlement(name: string): Promise<boolean>
  export function requireEntitlement(name: string): Promise<void>
}
```

Apache-2.0.
