<script setup lang="ts">
import type { LocaleInput } from '#shared/manifest'

// One locale field editor (rendered inside an expanded table row). `index` drives the UForm
// `name` paths. Required fields are marked; the full set of optional spec fields appears under
// showOptional. Complex fields (agreements/documentations/icons) round-trip via state but are
// not edited here — a note is shown when present.
const props = defineProps<{
  locale: LocaleInput
  index: number
  showOptional: boolean
}>()

const f = useObjectFields(() => props.locale as Record<string, unknown>)
const preserved = computed(() =>
  (['agreements', 'documentations', 'icons'] as const).filter(
    (k) => Array.isArray(props.locale[k]) && props.locale[k]!.length,
  ),
)
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="$t('Locale')" :name="`locales.${index}.packageLocale`" required>
        <UInput v-model="locale.packageLocale" placeholder="en-US" />
      </UFormField>
      <UFormField :label="$t('Package name')" :name="`locales.${index}.packageName`" :required="locale.isDefault">
        <UInput :model-value="f.str('packageName')" @update:model-value="f.setStr('packageName', String($event))" />
      </UFormField>
      <UFormField :label="$t('Publisher')" :name="`locales.${index}.publisher`" :required="locale.isDefault">
        <UInput :model-value="f.str('publisher')" @update:model-value="f.setStr('publisher', String($event))" />
      </UFormField>
      <UFormField :label="$t('License')" :name="`locales.${index}.license`" :required="locale.isDefault">
        <UInput :model-value="f.str('license')" @update:model-value="f.setStr('license', String($event))" />
      </UFormField>
      <UFormField :label="$t('Short description')" :name="`locales.${index}.shortDescription`" class="sm:col-span-2" :required="locale.isDefault">
        <UInput :model-value="f.str('shortDescription')" @update:model-value="f.setStr('shortDescription', String($event))" />
      </UFormField>

      <template v-if="showOptional">
        <UFormField :label="$t('Moniker')" :name="`locales.${index}.moniker`">
          <UInput :model-value="f.str('moniker')" @update:model-value="f.setStr('moniker', String($event))" />
        </UFormField>
        <UFormField :label="$t('Tags (comma-separated)')" :name="`locales.${index}.tags`">
          <UInput
            :model-value="(locale.tags ?? []).join(', ')"
            @update:model-value="locale.tags = String($event).split(',').map((t) => t.trim()).filter(Boolean)"
          />
        </UFormField>
        <UFormField :label="$t('Author')"><UInput :model-value="f.str('author')" @update:model-value="f.setStr('author', String($event))" /></UFormField>
        <UFormField :label="$t('Copyright')"><UInput :model-value="f.str('copyright')" @update:model-value="f.setStr('copyright', String($event))" /></UFormField>
        <UFormField :label="$t('Publisher URL')"><UInput :model-value="f.str('publisherUrl')" class="font-mono" @update:model-value="f.setStr('publisherUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Publisher support URL')"><UInput :model-value="f.str('publisherSupportUrl')" class="font-mono" @update:model-value="f.setStr('publisherSupportUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Package URL')"><UInput :model-value="f.str('packageUrl')" class="font-mono" @update:model-value="f.setStr('packageUrl', String($event))" /></UFormField>
        <UFormField :label="$t('License URL')"><UInput :model-value="f.str('licenseUrl')" class="font-mono" @update:model-value="f.setStr('licenseUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Privacy URL')"><UInput :model-value="f.str('privacyUrl')" class="font-mono" @update:model-value="f.setStr('privacyUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Copyright URL')"><UInput :model-value="f.str('copyrightUrl')" class="font-mono" @update:model-value="f.setStr('copyrightUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Purchase URL')"><UInput :model-value="f.str('purchaseUrl')" class="font-mono" @update:model-value="f.setStr('purchaseUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Release notes URL')"><UInput :model-value="f.str('releaseNotesUrl')" class="font-mono" @update:model-value="f.setStr('releaseNotesUrl', String($event))" /></UFormField>
        <UFormField :label="$t('Description')" class="sm:col-span-2">
          <UTextarea :model-value="f.str('description')" :rows="5" @update:model-value="f.setStr('description', String($event))" />
        </UFormField>
        <UFormField :label="$t('Release notes')" class="sm:col-span-2">
          <UTextarea :model-value="f.str('releaseNotes')" :rows="4" @update:model-value="f.setStr('releaseNotes', String($event))" />
        </UFormField>
        <UFormField :label="$t('Installation notes')" class="sm:col-span-2">
          <UTextarea :model-value="f.str('installationNotes')" :rows="3" @update:model-value="f.setStr('installationNotes', String($event))" />
        </UFormField>
        <p v-if="preserved.length" class="sm:col-span-2 text-xs text-muted">
          {{ $t('Preserved (visible in raw YAML, not edited here):') }} {{ preserved.join(', ') }}
        </p>
      </template>
    </div>
  </div>
</template>
