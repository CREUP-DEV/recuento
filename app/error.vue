<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, es } from '@nuxt/ui/locale'

const { error } = defineProps<{
  error: NuxtError
}>()

const { locale } = useI18n({ useScope: 'global' })
const { t } = useI18n({ useScope: 'global' })

const nuxtUiLocales = { es, en } as const
const currentLocale = computed(
  () => nuxtUiLocales[locale.value as keyof typeof nuxtUiLocales] ?? nuxtUiLocales.es
)

const status = computed(() => error.status ?? 500)

useHead({
  htmlAttrs: {
    lang: computed(() => currentLocale.value.code),
  },
})

useSeoMeta({
  title: () => `${status.value} | Recuento CREUP`,
  robots: 'noindex',
})

const handleError = async () => {
  await clearError({ redirect: '/' })
}

const route = useRoute()
watch(
  () => route.fullPath,
  async (newPath, oldPath) => {
    if (newPath !== oldPath) {
      await clearError()
    }
  }
)
</script>

<template>
  <UApp :locale="currentLocale">
    <div class="bg-background flex min-h-screen flex-col">
      <AppHeader />

      <main class="flex flex-1 items-center justify-center px-4 py-16">
        <div class="w-full max-w-xl text-center">
          <p aria-hidden="true" class="text-primary text-7xl font-bold sm:text-8xl">
            {{ status }}
          </p>
          <h1 class="mt-4 text-2xl font-semibold">
            {{ status === 404 ? t('common.notFound') : t('common.error') }}
          </h1>
          <p class="text-muted mt-3">
            {{ error.statusMessage || t('common.tryAgain') }}
          </p>
          <div class="mt-8 flex justify-center">
            <UButton size="lg" color="primary" @click="handleError">
              {{ t('common.goHome') }}
            </UButton>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  </UApp>
</template>
