<script setup lang="ts">
import { versionEditSchema, type InstallerInput, type LocaleInput } from '#shared/manifest'

definePageMeta({ middleware: 'can-write' })

// Structured editor for a Custom (origin === 'local') manifest. Validated against the shared
// Zod schema (also enforced server-side). State holds the full LocaleInput / InstallerInput
// shapes so every spec field round-trips, even those not surfaced in the form.
const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = computed(() => String(route.params.id))
const version = computed(() => String(route.params.version))
const { t } = useI18n()
useHead({ title: () => `${t('Edit')} ${id.value} ${version.value}` })
const apiUrl = computed(
  () => `/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}`,
)

const { data, error } = await useFetch(
  () => `/api/packages/${id.value}/versions/${encodeURIComponent(version.value)}`,
)

const state = reactive<ManifestFormState>({ locales: [], installers: [] })
watchEffect(() => {
  if (!data.value) return
  state.locales = data.value.locales as unknown as LocaleInput[]
  state.installers = data.value.installers as unknown as InstallerInput[]
})

const zf = useZodForm(versionEditSchema)
const formRef = ref()
zf.watchLive(formRef, state)
const saving = ref(false)
async function onSubmit() {
  if (!(await zf.submit(formRef.value))) return
  saving.value = true
  try {
    await $fetch(apiUrl.value, {
      method: 'PUT',
      body: { locales: state.locales, installers: state.installers },
    })
    toast.add({ title: 'Manifest saved', icon: 'i-lucide-check', color: 'success' })
    await router.push(`/packages/${id.value}/${encodeURIComponent(version.value)}`)
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Save failed'
    toast.add({ title: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl p-6 space-y-6">
    <ULink
      :to="`/packages/${id}/${encodeURIComponent(version)}`"
      class="text-sm text-muted hover:text-default"
    >
      {{ $t('← Back to version') }}
    </ULink>

    <UAlert v-if="error" color="error" :title="$t('Version not found')" :description="String(error)" />

    <template v-else-if="data">
      <header class="space-y-1">
        <h1 class="text-2xl font-bold">{{ $t('Edit manifest') }}</h1>
        <p class="font-mono text-muted">{{ data.packageIdentifier }} · {{ data.packageVersion }}</p>
      </header>

      <UAlert
        v-if="data.origin !== 'local'"
        color="info"
        variant="subtle"
        icon="i-lucide-layers"
        :description="$t('Saving changes to an upstream version creates a local overlay; the original stays recoverable.')"
      />

      <UForm
        ref="formRef"
        :validate="zf.validate"
        :validate-on="zf.validateOn"
        :state="state"
        class="space-y-6"
      >
        <ManifestTemplatePanel :package-identifier="id" :version="version" :installers="state.installers" />
        <ManifestLocaleTable :locales="state.locales" :show-optional="true" />
        <ManifestInstallerTable
          :installers="state.installers"
          :show-optional="true"
          :package-identifier="id"
          :package-version="version"
        />

        <div class="flex items-center justify-end gap-3">
          <UButton
            :to="`/packages/${id}/${encodeURIComponent(version)}`"
            color="neutral"
            variant="ghost"
          >
            {{ $t('Cancel') }}
          </UButton>
          <UButton :loading="saving" icon="i-lucide-save" @click="onSubmit">
            {{ $t('Save manifest') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </div>
</template>
