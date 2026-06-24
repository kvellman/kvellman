import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit + pipeline tests (Schicht 1+2): plain Vitest, no DB / no Nuxt boot. The few Nuxt/Nitro
// auto-import globals used by the code under test (useStorage, ref, watch) are stubbed per test.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['{shared,server,app}/**/*.test.ts'],
    exclude: ['node_modules', '.nuxt', '.output'],
  },
})
