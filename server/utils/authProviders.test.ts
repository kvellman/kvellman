import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the license check so we test the registry's entitlement filtering in isolation.
let entitlements: string[] = []
vi.mock('./license', () => ({ getEntitlements: async () => entitlements }))

import { enabledAuthProviders, registerAuthProvider } from './authProviders'

describe('authProviders', () => {
  beforeEach(() => {
    entitlements = []
  })

  it('hides an entitlement-gated provider until the entitlement is active', async () => {
    registerAuthProvider({ id: 'oidc', label: 'SSO', startPath: '/api/auth/oidc/login', entitlement: 'sso' })
    expect((await enabledAuthProviders()).map((p) => p.id)).not.toContain('oidc')
    entitlements = ['sso']
    expect((await enabledAuthProviders()).map((p) => p.id)).toContain('oidc')
  })

  it('always shows a provider without an entitlement', async () => {
    registerAuthProvider({ id: 'open-demo', label: 'Demo', startPath: '/x' })
    expect((await enabledAuthProviders()).map((p) => p.id)).toContain('open-demo')
  })
})
