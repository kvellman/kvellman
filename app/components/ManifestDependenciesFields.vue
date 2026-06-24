<script setup lang="ts">
import type { Dependencies, InstallerInput } from '#shared/manifest'

// Structured editor for installer.dependencies (Windows features/libraries, external deps, and
// package dependencies). The three simple lists are comma-separated; package deps are rows.
const props = defineProps<{ installer: InstallerInput }>()

function deps(): Dependencies {
  return props.installer.dependencies ?? {}
}
function commit(next: Dependencies) {
  const hasAny = (['windowsFeatures', 'windowsLibraries', 'externalDependencies', 'packageDependencies'] as const).some(
    (k) => Array.isArray(next[k]) && next[k]!.length,
  )
  props.installer.dependencies = hasAny ? next : null
}
function listText(key: 'windowsFeatures' | 'windowsLibraries' | 'externalDependencies') {
  return (deps()[key] ?? []).join(', ')
}
function setList(key: 'windowsFeatures' | 'windowsLibraries' | 'externalDependencies', text: string) {
  const list = text.split(',').map((s) => s.trim()).filter(Boolean)
  commit({ ...deps(), [key]: list.length ? list : null })
}
function pkgRows() {
  return deps().packageDependencies ?? []
}
function addPkg() {
  commit({ ...deps(), packageDependencies: [...pkgRows(), { packageIdentifier: '' }] })
}
function removePkg(i: number) {
  const next = [...pkgRows()]
  next.splice(i, 1)
  commit({ ...deps(), packageDependencies: next.length ? next : null })
}
</script>

<template>
  <div class="space-y-3 sm:col-span-3">
    <p class="text-sm font-medium">{{ $t('Dependencies') }}</p>
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField label="Windows features (comma-sep)" size="xs">
        <UInput :model-value="listText('windowsFeatures')" size="sm" @update:model-value="setList('windowsFeatures', String($event))" />
      </UFormField>
      <UFormField label="Windows libraries (comma-sep)" size="xs">
        <UInput :model-value="listText('windowsLibraries')" size="sm" @update:model-value="setList('windowsLibraries', String($event))" />
      </UFormField>
      <UFormField label="External deps (comma-sep)" size="xs">
        <UInput :model-value="listText('externalDependencies')" size="sm" @update:model-value="setList('externalDependencies', String($event))" />
      </UFormField>
    </div>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs text-muted">{{ $t('Package dependencies') }}</p>
        <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="soft" @click="addPkg">{{ $t('Add') }}</UButton>
      </div>
      <div v-for="(p, i) in pkgRows()" :key="i" class="flex items-end gap-2">
        <UFormField label="PackageIdentifier" size="xs" class="flex-1">
          <UInput v-model="p.packageIdentifier" size="sm" class="font-mono" />
        </UFormField>
        <UFormField label="MinimumVersion" size="xs" class="flex-1">
          <UInput :model-value="p.minimumVersion ?? ''" size="sm" class="font-mono" @update:model-value="p.minimumVersion = String($event) || null" />
        </UFormField>
        <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" @click="removePkg(i)" />
      </div>
    </div>
  </div>
</template>
