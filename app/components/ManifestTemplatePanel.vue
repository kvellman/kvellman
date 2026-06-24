<script setup lang="ts">
import type { InstallerInput } from '#shared/manifest'

// Per-package overlay template suggestion. Shows the package's saved override rules with the value
// they'd set for THIS version (placeholders resolved) and what was set on the source version as a
// hint. "Apply" fills the matching installer fields in the editor; the user reviews before saving.
const props = defineProps<{
  packageIdentifier: string
  version: string
  installers: InstallerInput[]
}>()

const { t } = useI18n()
const toast = useToast()

interface Rule { architecture: string; field: string; value: unknown }
const { data: tpl } = await useFetch<{ rules: Rule[]; sourceVersion: string | null }>(
  () => `/api/packages/${encodeURIComponent(props.packageIdentifier)}/template`,
  { default: () => ({ rules: [], sourceVersion: null }) },
)
const rules = computed(() => tpl.value?.rules ?? [])

function mapStrings(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === 'string') return fn(v)
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn))
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) o[k] = mapStrings(val, fn)
    return o
  }
  return v
}
function resolve(value: unknown, version: string, arch: string): unknown {
  return mapStrings(value, (s) => s.split('$VERSION').join(version).split('$ARCH').join(arch))
}
function fmt(v: unknown): string {
  return v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v)
}
function newValue(r: Rule): string {
  return fmt(resolve(r.value, props.version || '$VERSION', r.architecture))
}
function prevValue(r: Rule): string {
  return tpl.value?.sourceVersion ? fmt(resolve(r.value, tpl.value.sourceVersion, r.architecture)) : '—'
}

function applyTemplate() {
  let applied = 0
  for (const inst of props.installers as unknown as Record<string, unknown>[]) {
    for (const r of rules.value) {
      if (r.architecture === '*' || r.architecture === inst.architecture) {
        inst[r.field] = resolve(r.value, props.version, String(inst.architecture))
        applied++
      }
    }
  }
  toast.add(
    applied
      ? { title: t('Template applied ({n} fields)', { n: applied }), icon: 'i-lucide-check', color: 'success' }
      : { title: t('No installers match the template architectures'), icon: 'i-lucide-circle-alert', color: 'warning' },
  )
}
</script>

<template>
  <UCard v-if="rules.length">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">{{ $t('Overlay template') }}</h3>
          <p class="text-xs text-muted">
            {{ tpl?.sourceVersion ? $t('From version {v}', { v: tpl.sourceVersion }) : '' }}
          </p>
        </div>
        <UButton size="sm" icon="i-lucide-wand-2" @click="applyTemplate">{{ $t('Apply template') }}</UButton>
      </div>
    </template>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-default text-muted">
          <th class="py-1 pr-4 font-medium">{{ $t('Architecture') }}</th>
          <th class="py-1 pr-4 font-medium">{{ $t('Field') }}</th>
          <th class="py-1 pr-4 font-medium">{{ $t('New value') }}</th>
          <th class="py-1 font-medium">{{ $t('Previous') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rules" :key="i" class="border-b border-default/40 last:border-0 align-top">
          <td class="py-1 pr-4">{{ r.architecture }}</td>
          <td class="py-1 pr-4 font-mono text-xs">{{ r.field }}</td>
          <td class="py-1 pr-4 font-mono text-xs break-all">{{ newValue(r) }}</td>
          <td class="py-1 font-mono text-xs break-all text-muted">{{ prevValue(r) }}</td>
        </tr>
      </tbody>
    </table>
  </UCard>
</template>
