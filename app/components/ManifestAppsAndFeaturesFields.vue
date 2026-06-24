<script setup lang="ts">
import { INSTALLER_TYPES, type AppsAndFeaturesEntry, type InstallerInput } from '#shared/manifest'

// Structured editor for installer.appsAndFeaturesEntries (Add/Remove/Programs uninstall match).
const props = defineProps<{ installer: InstallerInput }>()

const typeItems = [{ label: '(none)', value: null }, ...INSTALLER_TYPES.map((t) => ({ label: t, value: t }))]

function rows(): AppsAndFeaturesEntry[] {
  return props.installer.appsAndFeaturesEntries ?? []
}
function add() {
  props.installer.appsAndFeaturesEntries = [...rows(), {}]
}
function remove(i: number) {
  const next = [...rows()]
  next.splice(i, 1)
  props.installer.appsAndFeaturesEntries = next.length ? next : null
}
</script>

<template>
  <div class="space-y-3 sm:col-span-3">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium">{{ $t('Apps & Features entries') }}</p>
      <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="soft" @click="add">{{ $t('Add entry') }}</UButton>
    </div>
    <div
      v-for="(e, i) in rows()"
      :key="i"
      class="grid gap-2 sm:grid-cols-2 rounded border border-default/50 p-3"
    >
      <UFormField label="DisplayName" size="xs">
        <UInput :model-value="e.displayName ?? ''" size="sm" @update:model-value="e.displayName = String($event) || null" />
      </UFormField>
      <UFormField label="Publisher" size="xs">
        <UInput :model-value="e.publisher ?? ''" size="sm" @update:model-value="e.publisher = String($event) || null" />
      </UFormField>
      <UFormField label="DisplayVersion" size="xs">
        <UInput :model-value="e.displayVersion ?? ''" size="sm" @update:model-value="e.displayVersion = String($event) || null" />
      </UFormField>
      <UFormField label="ProductCode" size="xs">
        <UInput :model-value="e.productCode ?? ''" size="sm" class="font-mono" @update:model-value="e.productCode = String($event) || null" />
      </UFormField>
      <UFormField label="UpgradeCode" size="xs">
        <UInput :model-value="e.upgradeCode ?? ''" size="sm" class="font-mono" @update:model-value="e.upgradeCode = String($event) || null" />
      </UFormField>
      <div class="flex items-end gap-2">
        <UFormField label="InstallerType" size="xs" class="flex-1">
          <USelect :model-value="e.installerType ?? null" :items="typeItems" size="sm" @update:model-value="e.installerType = $event" />
        </UFormField>
        <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" @click="remove(i)" />
      </div>
    </div>
  </div>
</template>
