<script setup lang="ts">
// Brand the browser tab: each page sets its own `title` via useHead; this template appends the
// product name. Pages that set no title fall back to the bare brand.
useHead({
  titleTemplate: (title) => (title ? `${title} · kvellman` : 'kvellman'),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
