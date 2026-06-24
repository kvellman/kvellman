<script setup lang="ts">
// How to register kvellman as an additional winget source (M5). Builds the per-site source URL
// from the current host + a configured site token, with copy-to-clipboard commands.
const { t } = useI18n()
const toast = useToast()
useHead({ title: () => t('Instructions') })

interface SiteToken {
  token: string
  site: string
  location: string
}
const { data: tokens } = await useFetch<SiteToken[]>('/api/site-tokens')

const origin = useRequestURL().origin
const selected = ref(tokens.value?.[0]?.token ?? '')

const tokenItems = computed(() =>
  (tokens.value ?? []).map((t) => ({ label: `${t.site} · ${t.location} (${t.token})`, value: t.token })),
)
const effectiveToken = computed(() => selected.value || '<your-site-token>')
const sourceUrl = computed(() => `${origin}/api/${effectiveToken.value}`)
const addCmd = computed(
  () => `winget source add --name kvellman --arg "${sourceUrl.value}" --type Microsoft.Rest`,
)

// Common follow-up commands (the source is referenced by its name "kvellman").
const commands = computed(() => [
  { label: t('List configured sources'), cmd: 'winget source list' },
  { label: t('Search this source'), cmd: 'winget search --source kvellman <term>' },
  { label: t('Install from this source'), cmd: 'winget install --source kvellman <PackageIdentifier>' },
  { label: t('Upgrade all'), cmd: 'winget upgrade --source kvellman --all' },
  { label: t('Remove the source'), cmd: 'winget source remove --name kvellman' },
])

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: t('Copied'), icon: 'i-lucide-check', color: 'success' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">{{ $t('Instructions') }}</h1>
      <p class="text-muted">{{ $t('Add kvellman as an additional winget source — no client changes required.') }}</p>
    </header>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('1. Choose a site') }}</h2></template>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ $t('The site token in the URL selects the location context (mirror, locale). Pick the site this machine belongs to.') }}
        </p>
        <USelect
          v-if="tokenItems.length"
          v-model="selected"
          :items="tokenItems"
          icon="i-lucide-map-pin"
          class="w-full sm:w-96"
        />
        <UAlert
          v-else
          color="warning"
          variant="subtle"
          icon="i-lucide-info"
          :description="$t('No site tokens configured yet — the command below uses a placeholder.')"
        />
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('2. Register the source') }}</h2></template>
      <div class="space-y-3">
        <p class="text-sm text-muted">{{ $t('Run this once in an elevated PowerShell / terminal:') }}</p>
        <div class="flex items-start gap-2">
          <pre class="flex-1 overflow-x-auto rounded bg-elevated p-3 font-mono text-xs">{{ addCmd }}</pre>
          <UButton icon="i-lucide-copy" color="neutral" variant="soft" size="sm" @click="copy(addCmd)">
            {{ $t('Copy') }}
          </UButton>
        </div>
        <p class="text-xs text-muted">
          {{ $t('Source URL: {url}', { url: sourceUrl }) }}
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">{{ $t('3. Use it') }}</h2></template>
      <div class="space-y-3">
        <div v-for="c in commands" :key="c.cmd" class="space-y-1">
          <p class="text-xs font-medium text-muted">{{ c.label }}</p>
          <div class="flex items-start gap-2">
            <pre class="flex-1 overflow-x-auto rounded bg-elevated p-2 font-mono text-xs">{{ c.cmd }}</pre>
            <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copy(c.cmd)">
              {{ $t('Copy') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
