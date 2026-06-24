<script setup lang="ts">
import {
  ARCHITECTURES,
  ELEVATION_REQUIREMENTS,
  INSTALLER_TYPES,
  INSTALL_MODES,
  NESTED_INSTALLER_TYPES,
  PLATFORMS,
  REPAIR_BEHAVIORS,
  SCOPES,
  SWITCH_KEYS,
  UNSUPPORTED_ARCHS,
  UNSUPPORTED_ARGS,
  UPGRADE_BEHAVIORS,
  type InstallerInput,
} from '#shared/manifest'

// One installer sub-form. Required fields always shown; the full optional spec field set appears
// under showOptional, including structured AppsAndFeaturesEntries + Dependencies editors.
const props = defineProps<{
  installer: InstallerInput
  index: number
  showOptional: boolean
  packageIdentifier?: string
  packageVersion?: string
}>()

const f = useObjectFields(() => props.installer as Record<string, unknown>)

// Upload the installer: store it in the local origin store under the package/version path and fill
// the SHA-256 + localFile. Delivery then serves the local copy. Requires the identifier + version.
const { t } = useI18n()
const toast = useToast()
const hashing = ref(false)
async function uploadInstaller(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!props.packageIdentifier?.trim() || !props.packageVersion?.trim()) {
    toast.add({ title: t('Enter the package identifier and version first'), icon: 'i-lucide-circle-alert', color: 'error' })
    input.value = ''
    return
  }
  hashing.value = true
  try {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('packageIdentifier', props.packageIdentifier)
    fd.append('packageVersion', props.packageVersion)
    const res = await $fetch<{ localFile: string; sha256: string }>('/api/installers/upload', {
      method: 'POST',
      body: fd,
    })
    props.installer.installerSha256 = res.sha256
    props.installer.localFile = res.localFile
    toast.add({ title: t('Installer stored'), icon: 'i-lucide-check', color: 'success' })
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Upload failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    hashing.value = false
    input.value = ''
  }
}
const none = (vals: readonly string[]) => [{ label: '(none)', value: null }, ...vals.map((v) => ({ label: v, value: v }))]
const scopeItems = none(SCOPES)
const nestedTypeItems = none(NESTED_INSTALLER_TYPES)
const upgradeItems = none(UPGRADE_BEHAVIORS)
const elevationItems = none(ELEVATION_REQUIREMENTS)
const repairItems = none(REPAIR_BEHAVIORS)

const BOOLS = [
  ['installerAbortsTerminal', 'InstallerAbortsTerminal'],
  ['installLocationRequired', 'InstallLocationRequired'],
  ['requireExplicitUpgrade', 'RequireExplicitUpgrade'],
  ['displayInstallWarnings', 'DisplayInstallWarnings'],
  ['downloadCommandProhibited', 'DownloadCommandProhibited'],
  ['archiveBinariesDependOnPath', 'ArchiveBinariesDependOnPath'],
] as const

function getSwitch(key: string): string {
  return props.installer.installerSwitches?.[key] ?? ''
}
function setSwitch(key: string, value: string) {
  const rec: Record<string, string> = { ...(props.installer.installerSwitches ?? {}) }
  if (value) rec[key] = value
  else delete rec[key]
  props.installer.installerSwitches = Object.keys(rec).length ? rec : null
}
function setIntArray(text: string) {
  const nums = text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
  props.installer.installerSuccessCodes = nums.length ? nums : null
}
const preserved = computed(() =>
  (['nestedInstallerFiles', 'expectedReturnCodes', 'markets', 'installationMetadata'] as const).filter(
    (k) => props.installer[k] != null,
  ),
)
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField label="Architecture" :name="`installers.${index}.architecture`" required>
        <USelect v-model="installer.architecture" :items="[...ARCHITECTURES]" />
      </UFormField>
      <UFormField label="Type" :name="`installers.${index}.installerType`" required>
        <USelect v-model="installer.installerType" :items="[...INSTALLER_TYPES]" />
      </UFormField>
      <UFormField v-if="showOptional" label="Scope" :name="`installers.${index}.scope`">
        <USelect :model-value="installer.scope ?? null" :items="scopeItems" @update:model-value="f.set('scope', $event)" />
      </UFormField>
      <UFormField label="Installer URL" :name="`installers.${index}.installerUrl`" hint="Supports $REPO_URL, $SITE, $LOCATION, $LANG" class="sm:col-span-3" required>
        <UInput v-model="installer.installerUrl" class="font-mono" />
      </UFormField>
      <UFormField
        label="SHA256"
        :name="`installers.${index}.installerSha256`"
        class="sm:col-span-3"
        :hint="$t('Upload the installer to store it and fill the SHA256 automatically')"
        required
      >
        <div class="flex items-center gap-2">
          <UInput v-model="installer.installerSha256" class="font-mono flex-1" />
          <UButton icon="i-lucide-upload" color="neutral" variant="soft" :loading="hashing">
            <label class="cursor-pointer">
              {{ $t('Upload installer') }}
              <input type="file" class="hidden" @change="uploadInstaller" />
            </label>
          </UButton>
        </div>
        <p v-if="installer.localFile" class="mt-1 text-xs text-muted">
          {{ $t('Stored locally: {file}', { file: installer.localFile }) }}
        </p>
      </UFormField>

      <template v-if="showOptional">
        <!-- Switches -->
        <div class="sm:col-span-3">
          <p class="mb-2 text-sm font-medium">{{ $t('Installer switches') }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField v-for="key in SWITCH_KEYS" :key="key" :label="key">
              <UInput :model-value="getSwitch(key)" class="font-mono" @update:model-value="setSwitch(key, String($event))" />
            </UFormField>
          </div>
        </div>

        <!-- Scalars / enums -->
        <UFormField label="SignatureSha256" class="sm:col-span-3"><UInput :model-value="f.str('signatureSha256')" class="font-mono" @update:model-value="f.setStr('signatureSha256', String($event))" /></UFormField>
        <UFormField label="Channel"><UInput :model-value="f.str('channel')" @update:model-value="f.setStr('channel', String($event))" /></UFormField>
        <UFormField label="InstallerLocale"><UInput :model-value="f.str('installerLocale')" placeholder="en-US" @update:model-value="f.setStr('installerLocale', String($event))" /></UFormField>
        <UFormField label="MinimumOSVersion"><UInput :model-value="f.str('minimumOsVersion')" @update:model-value="f.setStr('minimumOsVersion', String($event))" /></UFormField>
        <UFormField label="PackageFamilyName"><UInput :model-value="f.str('packageFamilyName')" class="font-mono" @update:model-value="f.setStr('packageFamilyName', String($event))" /></UFormField>
        <UFormField label="ProductCode"><UInput :model-value="f.str('productCode')" class="font-mono" @update:model-value="f.setStr('productCode', String($event))" /></UFormField>
        <UFormField label="ReleaseDate"><UInput :model-value="f.str('releaseDate')" placeholder="YYYY-MM-DD" @update:model-value="f.setStr('releaseDate', String($event))" /></UFormField>
        <UFormField label="NestedInstallerType"><USelect :model-value="installer.nestedInstallerType ?? null" :items="nestedTypeItems" @update:model-value="f.set('nestedInstallerType', $event)" /></UFormField>
        <UFormField label="UpgradeBehavior"><USelect :model-value="installer.upgradeBehavior ?? null" :items="upgradeItems" @update:model-value="f.set('upgradeBehavior', $event)" /></UFormField>
        <UFormField label="ElevationRequirement"><USelect :model-value="installer.elevationRequirement ?? null" :items="elevationItems" @update:model-value="f.set('elevationRequirement', $event)" /></UFormField>
        <UFormField label="RepairBehavior"><USelect :model-value="installer.repairBehavior ?? null" :items="repairItems" @update:model-value="f.set('repairBehavior', $event)" /></UFormField>

        <!-- Enum arrays -->
        <UFormField label="Platform"><USelectMenu :model-value="f.list('platform')" :items="[...PLATFORMS]" multiple @update:model-value="f.set('platform', ($event as unknown[]).length ? $event : null)" /></UFormField>
        <UFormField label="InstallModes"><USelectMenu :model-value="f.list('installModes')" :items="[...INSTALL_MODES]" multiple @update:model-value="f.set('installModes', ($event as unknown[]).length ? $event : null)" /></UFormField>
        <UFormField label="UnsupportedOSArchitectures"><USelectMenu :model-value="f.list('unsupportedOsArchitectures')" :items="[...UNSUPPORTED_ARCHS]" multiple @update:model-value="f.set('unsupportedOsArchitectures', ($event as unknown[]).length ? $event : null)" /></UFormField>
        <UFormField label="UnsupportedArguments"><USelectMenu :model-value="f.list('unsupportedArguments')" :items="[...UNSUPPORTED_ARGS]" multiple @update:model-value="f.set('unsupportedArguments', ($event as unknown[]).length ? $event : null)" /></UFormField>

        <!-- Free string / int arrays (comma-separated) -->
        <UFormField label="Commands (comma-sep)"><UInput :model-value="f.arr('commands')" @update:model-value="f.setArr('commands', String($event))" /></UFormField>
        <UFormField label="Protocols (comma-sep)"><UInput :model-value="f.arr('protocols')" @update:model-value="f.setArr('protocols', String($event))" /></UFormField>
        <UFormField label="FileExtensions (comma-sep)"><UInput :model-value="f.arr('fileExtensions')" @update:model-value="f.setArr('fileExtensions', String($event))" /></UFormField>
        <UFormField label="Capabilities (comma-sep)"><UInput :model-value="f.arr('capabilities')" @update:model-value="f.setArr('capabilities', String($event))" /></UFormField>
        <UFormField label="RestrictedCapabilities (comma-sep)"><UInput :model-value="f.arr('restrictedCapabilities')" @update:model-value="f.setArr('restrictedCapabilities', String($event))" /></UFormField>
        <UFormField label="InstallerSuccessCodes (comma-sep)"><UInput :model-value="(installer.installerSuccessCodes ?? []).join(', ')" @update:model-value="setIntArray(String($event))" /></UFormField>

        <!-- Booleans -->
        <div class="sm:col-span-3 grid gap-2 sm:grid-cols-2">
          <USwitch v-for="[key, label] in BOOLS" :key="key" :model-value="f.bool(key)" :label="label" @update:model-value="f.set(key, $event)" />
        </div>

        <!-- Structured complex editors -->
        <ManifestAppsAndFeaturesFields :installer="installer" />
        <ManifestDependenciesFields :installer="installer" />

        <UFormField :label="$t('Local file')" :name="`installers.${index}.localFile`" class="sm:col-span-3">
          <UInput :model-value="f.str('localFile')" placeholder="(optional)" class="font-mono" @update:model-value="f.setStr('localFile', String($event))" />
        </UFormField>
        <p v-if="preserved.length" class="sm:col-span-3 text-xs text-muted">
          {{ $t('Preserved (visible in raw YAML, not edited here):') }} {{ preserved.join(', ') }}
        </p>
      </template>
    </div>
  </div>
</template>
