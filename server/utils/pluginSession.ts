import type { H3Event } from 'h3'
import type { SessionUser } from './pluginAuth'

// Session helpers for plugins (e.g. an MFA gate marking the session verified). Exposed via
// #kvellman; wraps nuxt-auth-utils so plugins don't depend on it directly.
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await getUserSession(event)
  return (session?.user as SessionUser | undefined) ?? null
}

export async function getSessionFlag(event: H3Event, key: string): Promise<unknown> {
  const session = (await getUserSession(event)) as Record<string, unknown> | null
  return session?.[key]
}

export async function setSessionFlag(event: H3Event, key: string, value: unknown): Promise<void> {
  await setUserSession(event, { [key]: value } as Record<string, unknown>)
}
