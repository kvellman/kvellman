<script setup lang="ts">
import {
  DEFAULT_MANIFEST_VERSION,
  MANIFEST_VERSIONS,
  manifestCreateSchema,
  type InstallerInput,
  type LocaleInput,
  type ManifestCreateInput,
} from '#shared/manifest'

// Shared create form for a manifest version. Two modes:
//  • new package  → editable packageIdentifier (lockedIdentifier undefined)
//  • add version  → packageIdentifier fixed from the package (lockedIdentifier set, read-only)
// Import (paste/upload) runs the server pipeline and prefills the form. Submits to POST
// /api/packages (which upserts the package and rejects a duplicate version).
const props = defineProps<{
  lockedIdentifier?: string
  initial?: {
    packageVersion?: string
    manifestVersion?: (typeof MANIFEST_VERSIONS)[number]
    locales?: LocaleInput[]
    installers?: InstallerInput[]
  }
  submitLabel?: string
  cancelTo?: string
}>()

const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const state = reactive<
  {
    packageIdentifier: string
    packageVersion: string
    manifestVersion: (typeof MANIFEST_VERSIONS)[number]
  } & ManifestFormState
>({
  packageIdentifier: props.lockedIdentifier ?? '',
  packageVersion: props.initial?.packageVersion ?? '',
  manifestVersion: props.initial?.manifestVersion ?? DEFAULT_MANIFEST_VERSION,
  locales: props.initial?.locales ?? [emptyLocale(true)],
  installers: props.initial?.installers ?? [emptyInstaller()],
})
const showOptional = ref(!!props.initial)

// --- Import (paste / upload) -------------------------------------------------
const pasteText = ref('')
const importErrors = ref<{ path: string; message: string }[]>([])
const importing = ref(false)

function applyPayload(p: ManifestCreateInput) {
  // In add-version mode the identifier stays fixed to the package.
  if (!props.lockedIdentifier) state.packageIdentifier = p.packageIdentifier
  state.packageVersion = p.packageVersion
  state.manifestVersion = p.manifestVersion
  state.locales = p.locales
  state.installers = p.installers
  showOptional.value = true
}

async function loadParsed(body: BodyInit | Record<string, unknown>) {
  importing.value = true
  importErrors.value = []
  try {
    const { payload } = await $fetch<{ payload: ManifestCreateInput }>('/api/manifests/parse', {
      method: 'POST',
      body: body as Record<string, unknown>,
    })
    applyPayload(payload)
    toast.add({ title: t('Manifest loaded — review and save'), icon: 'i-lucide-check', color: 'success' })
  } catch (e: unknown) {
    const data = (e as { data?: { statusMessage?: string; data?: { errors?: unknown } } })?.data
    const errs = data?.data?.errors
    if (Array.isArray(errs)) importErrors.value = errs as { path: string; message: string }[]
    else toast.add({ title: data?.statusMessage ?? t('Parse failed'), icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    importing.value = false
  }
}
function importPaste() {
  if (pasteText.value.trim()) loadParsed({ text: pasteText.value })
}
function importFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  const fd = new FormData()
  for (const f of Array.from(files)) fd.append('files', f, f.name)
  loadParsed(fd)
}

// --- Submit ------------------------------------------------------------------
const zf = useZodForm(manifestCreateSchema)
const formRef = ref()
zf.watchLive(formRef, state)
const saving = ref(false)
async function onSubmit() {
  if (!(await zf.submit(formRef.value))) return
  saving.value = true
  try {
    const res = await $fetch<{ packageIdentifier: string; packageVersion: string }>('/api/packages', {
      method: 'POST',
      body: {
        packageIdentifier: state.packageIdentifier,
        packageVersion: state.packageVersion,
        manifestVersion: state.manifestVersion,
        locales: state.locales,
        installers: state.installers,
      },
    })
    toast.add({ title: t('Manifest saved'), icon: 'i-lucide-check', color: 'success' })
    await router.push(`/packages/${res.packageIdentifier}/${encodeURIComponent(res.packageVersion)}`)
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('Save failed')
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Import -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ $t('Import (optional)') }}</h2>
      </template>
      <div class="space-y-3">
        <UTextarea
          v-model="pasteText"
          :rows="6"
          class="w-full font-mono"
          :placeholder="$t(`Paste a singleton manifest, or multiple winget files separated by '---'…`)"
        />
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            icon="i-lucide-clipboard-check"
            color="neutral"
            variant="soft"
            :loading="importing"
            :disabled="!pasteText.trim()"
            @click="importPaste"
          >
            {{ $t('Validate & load pasted YAML') }}
          </UButton>
          <span class="text-sm text-muted">{{ $t('or') }}</span>
          <UButton icon="i-lucide-upload" color="neutral" variant="soft" :loading="importing">
            <label class="cursor-pointer">
              {{ $t('Upload .yaml file(s)') }}
              <input type="file" multiple accept=".yaml,.yml" class="hidden" @change="importFiles" />
            </label>
          </UButton>
        </div>
        <UAlert
          v-if="importErrors.length"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="$t('Validation failed')"
        >
          <template #description>
            <ul class="list-disc space-y-0.5 pl-4 font-mono text-xs">
              <li v-for="(err, i) in importErrors" :key="i">
                <span class="text-muted">{{ err.path }}</span> {{ err.message }}
              </li>
            </ul>
          </template>
        </UAlert>
      </div>
    </UCard>

    <!-- Form -->
    <UForm
      ref="formRef"
      :validate="zf.validate"
      :validate-on="zf.validateOn"
      :state="state"
      class="space-y-6"
    >
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ $t('Package') }}</h2>
            <USwitch v-model="showOptional" :label="$t('Show optional fields')" />
          </div>
        </template>
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormField :label="$t('Package identifier')" name="packageIdentifier" required>
            <UInput
              v-model="state.packageIdentifier"
              :disabled="!!lockedIdentifier"
              placeholder="Publisher.Package"
              class="font-mono"
            />
          </UFormField>
          <UFormField :label="$t('Version')" name="packageVersion" required>
            <UInput v-model="state.packageVersion" placeholder="1.0.0" class="font-mono" />
          </UFormField>
          <UFormField :label="$t('Manifest version')" name="manifestVersion" required>
            <USelect v-model="state.manifestVersion" :items="[...MANIFEST_VERSIONS]" />
          </UFormField>
        </div>
      </UCard>

      <ManifestTemplatePanel
        v-if="lockedIdentifier"
        :package-identifier="lockedIdentifier"
        :version="state.packageVersion"
        :installers="state.installers"
      />
      <ManifestLocaleTable :locales="state.locales" :show-optional="showOptional" />
      <ManifestInstallerTable
        :installers="state.installers"
        :show-optional="showOptional"
        :package-identifier="state.packageIdentifier"
        :package-version="state.packageVersion"
      />

      <div class="flex items-center justify-end gap-3">
        <UButton :to="cancelTo ?? '/'" color="neutral" variant="ghost">{{ $t('Cancel') }}</UButton>
        <UButton :loading="saving" icon="i-lucide-save" @click="onSubmit">
          {{ submitLabel ?? $t('Save manifest') }}
        </UButton>
      </div>
    </UForm>
  </div>
</template>
