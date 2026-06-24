<script setup lang="ts">
import type { InstallerInput, LocaleInput, MANIFEST_VERSIONS } from '#shared/manifest'

// Add a new version to an EXISTING package. The package identifier is taken from the route and
// locked; the form is prefilled from the latest stored version as a template (version number
// cleared so a new one must be entered).
const route = useRoute()
const { t } = useI18n()
const id = computed(() => String(route.params.id))
useHead({ title: () => `${t('New version')} – ${id.value}` })

const { data: pkg, error } = await useFetch(() => `/api/packages/${id.value}`)
const latestVersion = pkg.value?.versions?.at(-1)?.packageVersion
const { data: latest } = await useFetch(
  () => `/api/packages/${id.value}/versions/${encodeURIComponent(latestVersion ?? '')}`,
  { immediate: !!latestVersion },
)

const initial = computed(() =>
  latest.value
    ? {
        packageVersion: '',
        manifestVersion: latest.value.manifestVersion as (typeof MANIFEST_VERSIONS)[number],
        locales: latest.value.locales as unknown as LocaleInput[],
        installers: latest.value.installers as unknown as InstallerInput[],
      }
    : undefined,
)
</script>

<template>
  <div class="mx-auto max-w-7xl p-6 space-y-6">
    <ULink :to="`/packages/${id}`" class="text-sm text-muted hover:text-default">
      {{ $t('← Back to {name}', { name: id }) }}
    </ULink>

    <UAlert v-if="error" color="error" :title="$t('Package not found')" :description="String(error)" />

    <template v-else>
      <header class="space-y-1">
        <h1 class="text-2xl font-bold">{{ $t('Add version') }}</h1>
        <p class="font-mono text-muted">{{ id }}</p>
        <p v-if="latestVersion" class="text-sm text-muted">
          {{ $t('Prefilled from the latest version ({version}) — enter the new version number and adjust as needed.', { version: latestVersion }) }}
        </p>
      </header>

      <ManifestForm
        :locked-identifier="id"
        :initial="initial"
        :submit-label="$t('Add version')"
        :cancel-to="`/packages/${id}`"
      />
    </template>
  </div>
</template>
