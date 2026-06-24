<script setup lang="ts">
import type { InstallerInput } from '#shared/manifest'

// Compact installer table; editing a row expands the full field editor inline (one open at a
// time). Mutates the passed reactive array in place.
const props = defineProps<{
  installers: InstallerInput[]
  showOptional: boolean
  // Needed so an uploaded installer is stored under the right package/version path.
  packageIdentifier?: string
  packageVersion?: string
}>()

// Expand the first row by default so its required fields are immediately visible.
const expanded = ref<number | null>(props.installers.length ? 0 : null)
function toggle(i: number) {
  expanded.value = expanded.value === i ? null : i
}
function add() {
  props.installers.push(emptyInstaller())
  expanded.value = props.installers.length - 1
}
function remove(i: number) {
  props.installers.splice(i, 1)
  if (expanded.value === i) expanded.value = null
  else if (expanded.value !== null && expanded.value > i) expanded.value--
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ $t('Installers ({count})', { count: installers.length }) }}</h2>
        <UButton icon="i-lucide-plus" size="sm" color="neutral" variant="soft" @click="add">
          {{ $t('Add installer') }}
        </UButton>
      </div>
    </template>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-default text-muted">
          <th class="py-2 pr-4 font-medium">{{ $t('Arch') }}</th>
          <th class="py-2 pr-4 font-medium">{{ $t('Type') }}</th>
          <th class="py-2 pr-4 font-medium">URL</th>
          <th class="py-2 font-medium text-right">{{ $t('Actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(inst, i) in installers" :key="i">
          <tr class="border-b border-default/50" :class="expanded === i ? 'bg-elevated/40' : ''">
            <td class="py-2 pr-4">{{ inst.architecture }}</td>
            <td class="py-2 pr-4">{{ inst.installerType }}</td>
            <td class="py-2 pr-4 font-mono truncate max-w-xs">{{ inst.installerUrl || '—' }}</td>
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
                :disabled="installers.length === 1"
                @click="remove(i)"
              />
            </td>
          </tr>
          <tr v-if="expanded === i" :key="`e${i}`">
            <td colspan="4" class="p-4 bg-elevated/20 border-b border-default/50">
              <ManifestInstallerFields
                :installer="inst"
                :index="i"
                :show-optional="showOptional"
                :package-identifier="packageIdentifier"
                :package-version="packageVersion"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </UCard>
</template>
