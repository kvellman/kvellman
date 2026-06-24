<script setup lang="ts">
definePageMeta({ middleware: 'can-write' })
// Create a brand-new package + its first version. The package identifier is entered here; to add
// further versions to an existing package use the "Add version" action on the package page.
const { t } = useI18n()
useHead({ title: () => t('New package') })
</script>

<template>
  <div class="mx-auto max-w-7xl p-6 space-y-6">
    <ULink to="/packages" class="text-sm text-muted hover:text-default">{{ $t('← Back to packages') }}</ULink>

    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('New package') }}</h1>
      <p class="text-muted">{{ $t('Fill the form, paste YAML, or upload .yaml file(s).') }}</p>
    </header>

    <ManifestForm :submit-label="$t('Create package')" cancel-to="/packages" />
  </div>
</template>
