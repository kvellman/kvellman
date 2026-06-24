import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/client'
import { nodeMirrorRequests, nodes, packages } from '../../../db/schema'
import type { SiteContext } from '../../../services/sites'
import { resolveInstaller } from '../../../utils/resolve'

// POST /api/nodes/{id}/mirror — admin asks a node to pre-stage (mirror) a package version's
// installers. The origin resolves the installer URLs now (so the node can fetch them straight from
// its heartbeat response); the node downloads + caches them and reports them back as mirrored, which
// clears the request. Admin-gated by the /api/nodes middleware.
const schema = z.object({
  packageIdentifier: z.string().trim().min(1),
  packageVersion: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
  const nodeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(nodeId)) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })

  const parsed = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const { packageIdentifier, packageVersion } = parsed.data

  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
    columns: { id: true, filterArchitectures: true, filterScopes: true },
  })
  if (!node) throw createError({ statusCode: 404, statusMessage: 'Node not found' })

  const pkg = await db.query.packages.findFirst({
    where: sql`lower(${packages.packageIdentifier}) = lower(${packageIdentifier})`,
    with: { versions: { with: { installers: true } } },
  })
  const ver = pkg?.versions.find(
    (v) => v.packageVersion === packageVersion && v.approvalStatus === 'approved',
  )
  if (!pkg || !ver) throw createError({ statusCode: 404, statusMessage: 'Approved version not found' })

  // Apply the node's installer filter: only mirror matching architectures/scopes. A no-scope
  // installer serves any scope, so it passes the scope filter.
  const archOk = (a: string) => node.filterArchitectures.length === 0 || node.filterArchitectures.includes(a)
  const scopeOk = (s: string | null) => node.filterScopes.length === 0 || !s || node.filterScopes.includes(s)
  const selected = ver.installers.filter((i) => archOk(i.architecture) && scopeOk(i.scope))

  // Resolve installer URLs against the public origin base, so the node fetches them from the origin
  // (locally-hosted via /dl) or the vendor directly — the same URLs a client manifest would carry.
  const repoUrl = useRuntimeConfig().repoUrl as string
  const ctx: SiteContext = {
    site: 'Unknown',
    location: 'Unknown',
    defaultLocale: 'en-US',
    repoUrl,
    mirrorLocally: false,
  }
  const resolved = await Promise.all(
    selected.map((inst) => resolveInstaller(inst, ctx, ctx.defaultLocale, repoUrl)),
  )
  const urls = resolved
    .map((d) => d.InstallerUrl)
    .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
  if (urls.length === 0) throw createError({ statusCode: 400, statusMessage: 'No installers match this node’s filter' })

  await db
    .insert(nodeMirrorRequests)
    .values({ nodeId, packageIdentifier: pkg.packageIdentifier, packageVersion: ver.packageVersion, urls })
    .onConflictDoUpdate({
      target: [nodeMirrorRequests.nodeId, nodeMirrorRequests.packageIdentifier, nodeMirrorRequests.packageVersion],
      set: { urls },
    })

  return { ok: true, installers: urls.length }
})
