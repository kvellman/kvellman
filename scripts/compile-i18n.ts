// Compiles gettext translation sources (i18n/po/<lang>.po or .mo) into the flat JSON message
// files that @nuxtjs/i18n loads (i18n/locales/<lang>.json: { msgid: msgstr }).
//
//   pnpm i18n:compile
//
// Add a language by dropping i18n/po/<lang>.po, running this, and registering <lang> in nuxt.config.
// Keys are the English source strings; empty msgstr entries are skipped (they fall back to English).

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import gettextParser from 'gettext-parser'

const poDir = resolve(process.cwd(), 'i18n/po')
const outDir = resolve(process.cwd(), 'i18n/locales')

async function run() {
  await mkdir(outDir, { recursive: true })
  let files: string[] = []
  try {
    files = await readdir(poDir)
  } catch {
    console.log('No i18n/po directory — nothing to compile.')
    return
  }

  // Every msgid seen across all sources — used to build the English identity map (keys ARE the
  // English source strings, so en.json maps each to itself; this also makes vue-i18n interpolate
  // placeholders like {count} in the default locale instead of printing the raw key).
  const allMsgids = new Set<string>()
  let enOverrides: Record<string, string> = {}

  for (const file of files) {
    const ext = extname(file)
    if (ext !== '.po' && ext !== '.mo') continue
    const lang = basename(file, ext)
    const buf = await readFile(resolve(poDir, file))
    const parsed = ext === '.mo' ? gettextParser.mo.parse(buf) : gettextParser.po.parse(buf)

    const out: Record<string, string> = {}
    for (const context of Object.values(parsed.translations)) {
      for (const [msgid, entry] of Object.entries(context)) {
        if (!msgid) continue // the empty msgid holds the .po header
        allMsgids.add(msgid)
        const msgstr = entry.msgstr?.[0] ?? ''
        if (msgstr) out[msgid] = msgstr
      }
    }

    if (lang === 'en') {
      enOverrides = out
    } else {
      await writeFile(resolve(outDir, `${lang}.json`), JSON.stringify(out, null, 2) + '\n')
      console.log(`✓ ${lang}: ${Object.keys(out).length} strings`)
    }
  }

  // English = source identity (each key maps to itself), with any en.po entries layered on top.
  const enOut: Record<string, string> = {}
  for (const id of allMsgids) enOut[id] = id
  Object.assign(enOut, enOverrides)
  await writeFile(resolve(outDir, 'en.json'), JSON.stringify(enOut, null, 2) + '\n')
  console.log(`✓ en: ${Object.keys(enOut).length} strings (identity)`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
