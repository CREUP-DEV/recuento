<script setup lang="ts">
import { en, es } from '@nuxt/ui/locale'

const { locale } = useI18n()

const nuxtUiLocales = { en, es } as const
const currentUiLocale = computed(
  () => nuxtUiLocales[locale.value as keyof typeof nuxtUiLocales] ?? nuxtUiLocales.es
)

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
  },
  meta: [
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
    { name: 'theme-color', content: '#792225' },
  ],
  titleTemplate: (titleChunk) => (titleChunk ? `${titleChunk} | Recuento CREUP` : 'Recuento CREUP'),
}))
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="var(--color-creup-red-500)" />
  <UApp :locale="currentUiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
