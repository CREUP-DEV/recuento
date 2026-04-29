<script setup lang="ts">
import { en, es } from '@nuxt/ui/locale'

const { locale, t } = useI18n()

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
    <NuxtErrorBoundary>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>

      <template #error="{ error, clearError }">
        <main class="bg-background flex min-h-screen items-center justify-center px-4 py-16">
          <div
            class="border-default bg-default w-full max-w-xl rounded-2xl border p-6 text-center shadow-sm sm:p-8"
          >
            <p class="text-primary text-4xl font-bold">500</p>
            <h1 class="mt-3 text-2xl font-semibold">{{ t('common.error') }}</h1>
            <p class="text-muted mt-3">
              {{ error?.message || t('common.tryAgain') }}
            </p>
            <div class="mt-6 flex justify-center">
              <UButton color="primary" @click="clearError()">
                {{ t('common.retry') }}
              </UButton>
            </div>
          </div>
        </main>
      </template>
    </NuxtErrorBoundary>
  </UApp>
</template>
