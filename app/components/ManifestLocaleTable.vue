<script setup lang="ts">
import type { LocaleInput } from '#shared/manifest'

// Compact locale table; editing a row expands the full field editor inline (one open at a time)
// so the page stays short. Mutates the passed reactive array in place.
const props = defineProps<{ locales: LocaleInput[]; showOptional: boolean }>()

// Expand the first row by default so its required fields are immediately visible.
const expanded = ref<number | null>(props.locales.length ? 0 : null)
function toggle(i: number) {
  expanded.value = expanded.value === i ? null : i
}
function add() {
  props.locales.push(emptyLocale(props.locales.length === 0))
  expanded.value = props.locales.length - 1
}
function remove(i: number) {
  const wasDefault = props.locales[i]?.isDefault
  props.locales.splice(i, 1)
  if (wasDefault && props.locales[0]) props.locales[0].isDefault = true
  if (expanded.value === i) expanded.value = null
  else if (expanded.value !== null && expanded.value > i) expanded.value--
}
function setDefault(i: number) {
  props.locales.forEach((l, idx) => (l.isDefault = idx === i))
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ $t('Locales ({count})', { count: locales.length }) }}</h2>
        <UButton icon="i-lucide-plus" size="sm" color="neutral" variant="soft" @click="add">
          {{ $t('Add locale') }}
        </UButton>
      </div>
    </template>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-default text-muted">
          <th class="py-2 pr-4 font-medium">{{ $t('Locale') }}</th>
          <th class="py-2 pr-4 font-medium">{{ $t('Package name') }}</th>
          <th class="py-2 pr-4 font-medium">{{ $t('Default') }}</th>
          <th class="py-2 font-medium text-right">{{ $t('Actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(loc, i) in locales" :key="i">
          <tr class="border-b border-default/50" :class="expanded === i ? 'bg-elevated/40' : ''">
            <td class="py-2 pr-4 font-mono">{{ loc.packageLocale || '—' }}</td>
            <td class="py-2 pr-4">{{ loc.packageName || '—' }}</td>
            <td class="py-2 pr-4">
              <UBadge v-if="loc.isDefault" color="info" variant="subtle" size="sm">{{ $t('Default') }}</UBadge>
              <UButton v-else size="xs" color="neutral" variant="ghost" @click="setDefault(i)">
                {{ $t('Set default') }}
              </UButton>
            </td>
            <td class="py-2 text-right whitespace-nowrap">
              <UButton
                :icon="expanded === i ? 'i-lucide-chevron-up' : 'i-lucide-pencil'"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="toggle(i)"
              >
                {{ expanded === i ? $t('Close') : $t('Edit') }}
              </UButton>
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :disabled="locales.length === 1"
                @click="remove(i)"
              />
            </td>
          </tr>
          <tr v-if="expanded === i" :key="`e${i}`">
            <td colspan="4" class="p-4 bg-elevated/20 border-b border-default/50">
              <ManifestLocaleFields :locale="loc" :index="i" :show-optional="showOptional" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </UCard>
</template>
