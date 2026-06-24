import { Octokit } from '@octokit/rest'

// Read-only access to the microsoft/winget-pkgs repo for on-demand import. Fetches only the chosen
// version's manifest files (no wholesale mirror). Network-dependent → unavailable air-gapped.

const OWNER = 'microsoft'
const REPO = 'winget-pkgs'

// winget-pkgs path convention: manifests/<first-letter-lowercased>/<dotted identifier as dirs>.
export function upstreamPath(packageIdentifier: string): string {
  const first = packageIdentifier.charAt(0).toLowerCase()
  return `manifests/${first}/${packageIdentifier.split('.').join('/')}`
}

let client: Octokit | null = null
function octokit(): Octokit {
  if (!client) {
    const token = useRuntimeConfig().githubToken as string
    client = new Octokit(token ? { auth: token } : {})
  }
  return client
}

interface ContentEntry {
  name: string
  type: string
  download_url: string | null
  sha: string
}

function upstreamError(e: unknown): Error {
  const status = (e as { status?: number })?.status
  if (status === 403) {
    return createError({ statusCode: 502, statusMessage: 'GitHub rate limit reached (set GITHUB_TOKEN)' })
  }
  return createError({ statusCode: 502, statusMessage: 'winget-pkgs upstream is unreachable' })
}

async function listDir(path: string): Promise<ContentEntry[]> {
  const res = await octokit().repos.getContent({ owner: OWNER, repo: REPO, path })
  if (!Array.isArray(res.data)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found upstream' })
  }
  return res.data as ContentEntry[]
}

// Resolve the package directory's git-tree SHA by listing its parent and matching the last segment.
async function packageTreeSha(packageIdentifier: string): Promise<string | null> {
  const segs = packageIdentifier.split('.')
  const parent = `manifests/${packageIdentifier.charAt(0).toLowerCase()}/${segs.slice(0, -1).join('/')}`.replace(/\/$/, '')
  let entries: ContentEntry[]
  try {
    entries = await listDir(parent)
  } catch (e) {
    if ((e as { status?: number })?.status === 404) return null
    throw upstreamError(e)
  }
  const dir = entries.find((e) => e.type === 'dir' && e.name === segs[segs.length - 1])
  return dir?.sha ?? null
}

export async function listUpstreamVersions(packageIdentifier: string): Promise<string[]> {
  // In winget-pkgs a package directory mixes real version dirs (which hold the manifest .yaml files)
  // with sub-package dirs (e.g. Mozilla.Firefox also has Beta / ESR / per-locale editions). Pull the
  // recursive tree once and treat a child as a version only when a manifest .yaml sits directly
  // inside it (depth 2) — sub-packages keep their .yaml one level deeper.
  const sha = await packageTreeSha(packageIdentifier)
  if (!sha) return []
  let tree
  try {
    tree = await octokit().git.getTree({ owner: OWNER, repo: REPO, tree_sha: sha, recursive: 'true' })
  } catch (e) {
    throw upstreamError(e)
  }
  const versions = new Set<string>()
  for (const t of tree.data.tree) {
    if (t.type === 'blob' && t.path && t.path.endsWith('.yaml')) {
      const parts = t.path.split('/')
      if (parts.length === 2) versions.add(parts[0]!)
    }
  }
  return [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) // newest first
}

export async function fetchUpstreamManifest(packageIdentifier: string, version: string): Promise<string[]> {
  let entries: ContentEntry[]
  try {
    entries = await listDir(`${upstreamPath(packageIdentifier)}/${version}`)
  } catch (e) {
    if ((e as { status?: number })?.status === 404) {
      throw createError({ statusCode: 404, statusMessage: `Version ${version} not found upstream` })
    }
    throw upstreamError(e)
  }
  const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.yaml') && e.download_url)
  if (files.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No manifest files found upstream' })
  }
  return Promise.all(files.map((f) => $fetch<string>(f.download_url!, { responseType: 'text' })))
}
