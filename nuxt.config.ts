import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },

  // UI layer: Nuxt UI v4 + Tailwind v4.
  // nuxt-auth-utils: local accounts + sealed-cookie sessions (M5-A, Community auth).
  modules: ['@nuxt/ui', '@nuxtjs/i18n', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],

  // Brand favicon (kvellman "K" mark, see app/components/AppLogo.vue and public/favicon.svg).
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  // i18n: English default, German switchable, no URL prefixes (cookie-persisted). Message keys are
  // the English source strings (gettext msgid style); translations live in i18n/po/*.po and are
  // compiled to i18n/locales/*.json by scripts/compile-i18n.ts. Add a language by dropping a new
  // .po, running `pnpm i18n:compile`, and registering it here.
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
    vueI18n: 'i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'kvellman_lang',
      redirectOn: 'root',
    },
  },

  runtimeConfig: {
    // Default $REPO_URL when a site has no specific override (server-side only).
    repoUrl: process.env.REPO_URL ?? 'http://localhost:3000',
    // Local filesystem root for stored installer binaries (origin storage).
    installerStore: process.env.INSTALLER_STORE ?? './data/installers',
    // Optional GitHub token for winget-pkgs on-demand import (raises the API rate limit).
    githubToken: process.env.GITHUB_TOKEN ?? '',
    // Scheduled upstream-catalog sync (in-process interval; off by default, opt-in via env).
    catalogSyncEnabled: process.env.CATALOG_SYNC_ENABLED === 'true',
    catalogSyncIntervalHours: Number(process.env.CATALOG_SYNC_INTERVAL_HOURS ?? '6'),
    // Repository-usage telemetry (request signals from winget clients). Off by default; opt-in.
    telemetryEnabled: process.env.TELEMETRY_ENABLED === 'true',
    // Days of raw telemetry_events to keep before the aggregator purges them (daily rollup persists).
    telemetryRetentionDays: Number(process.env.TELEMETRY_RETENTION_DAYS ?? '90'),
    // Edge-node PKI: CA storage dir + the header a reverse proxy uses to forward the verified
    // client certificate (URL-encoded PEM) for node mTLS.
    pkiDir: process.env.PKI_DIR ?? './data/pki',
    nodeCertHeader: process.env.NODE_CERT_HEADER ?? 'x-client-cert',
    // Override the baked-in vendor public key used to verify Enterprise licenses (testing only).
    licensePublicKey: process.env.LICENSE_PUBLIC_KEY ?? '',
  },

  // Bundle the official winget JSON schemas (all versions) as server assets so the validation
  // pipeline works air-gapped. Loaded via useStorage('assets:winget-schemas').
  nitro: {
    serverAssets: [
      {
        baseName: 'winget-schemas',
        dir: fileURLToPath(new URL('./server/schemas/winget', import.meta.url)),
      },
      // sql.js WASM, used to read the winget index (catalog sync). Bundled for air-gapped builds.
      {
        baseName: 'sqljs',
        dir: fileURLToPath(new URL('./server/assets/sql', import.meta.url)),
      },
    ],
    // Stable host API import path for plugins (see server/utils/pluginHost.ts, @kvellman/plugin-sdk).
    alias: {
      '#kvellman': fileURLToPath(new URL('./server/utils/pluginHost.ts', import.meta.url)),
    },
  },
})
