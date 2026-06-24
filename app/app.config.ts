// Nuxt UI theme overrides. By default the form inputs' root wrapper is `inline-flex` (shrinks to
// a default width); make it full-width so fields fill their form-grid cell.
export default defineAppConfig({
  ui: {
    input: { slots: { root: 'w-full' } },
    textarea: { slots: { root: 'w-full' } },
    select: { slots: { base: 'w-full' } },
    selectMenu: { slots: { base: 'w-full' } },
  },
})
