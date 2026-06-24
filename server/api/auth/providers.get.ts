import { enabledAuthProviders } from '../../utils/authProviders'

// GET /api/auth/providers — login methods registered by plugins and currently licensed. Public, so
// the login page can render the buttons before authentication.
export default defineEventHandler(async () => {
  const providers = await enabledAuthProviders()
  return providers.map((p) => ({ id: p.id, label: p.label, startPath: p.startPath, icon: p.icon }))
})
