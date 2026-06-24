import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { pluginData } from '../db/schema'

// Per-user, plugin-namespaced storage (e.g. an MFA secret). Exposed to plugins via #kvellman.
export async function getPluginData<T = unknown>(plugin: string, userId: number, key: string): Promise<T | null> {
  const row = await db.query.pluginData.findFirst({
    where: and(eq(pluginData.plugin, plugin), eq(pluginData.userId, userId), eq(pluginData.key, key)),
  })
  return (row?.value ?? null) as T | null
}

export async function setPluginData(plugin: string, userId: number, key: string, value: unknown): Promise<void> {
  await db
    .insert(pluginData)
    .values({ plugin, userId, key, value })
    .onConflictDoUpdate({ target: [pluginData.plugin, pluginData.userId, pluginData.key], set: { value } })
}

export async function deletePluginData(plugin: string, userId: number, key: string): Promise<void> {
  await db
    .delete(pluginData)
    .where(and(eq(pluginData.plugin, plugin), eq(pluginData.userId, userId), eq(pluginData.key, key)))
}
