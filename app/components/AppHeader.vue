<script setup lang="ts">
const { t, locale } = useI18n()
const { setLocale } = useI18n()
const localePath = useLocalePath()
const { activeVote } = useActiveVote()
const { session } = useAuth()

const defaultLocaleItem = { code: 'es', flag: 'i-circle-flags-es', name: 'Español' } as const

const localeItems = [
  { code: 'es', flag: 'i-circle-flags-es', name: 'Español' },
  { code: 'en', flag: 'i-circle-flags-gb', name: 'English' },
] as const

const currentLocale = computed(
  () => localeItems.find((l) => l.code === locale.value) ?? defaultLocaleItem
)

async function switchLocale(code: 'es' | 'en') {
  await setLocale(code)
}
</script>

<template>
  <header
    id="main-navigation"
    class="border-default/80 from-creup-beige-50/85 via-background/92 to-background/92 dark:from-creup-dark-gray-950/80 sticky top-0 z-40 border-b bg-gradient-to-b backdrop-blur-lg"
  >
    <div class="mx-auto flex min-h-18 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <NuxtLink
        :to="localePath('/')"
        class="focus-visible:ring-primary/60 rounded-sm transition focus-visible:ring-2 focus-visible:outline-none"
        :aria-label="t('nav.home')"
      >
        <AppLogo class="h-8 w-auto sm:h-9" />
      </NuxtLink>

      <NuxtLink
        v-if="activeVote"
        :to="localePath(`/votes/${activeVote.id}`)"
        class="border-default/80 ml-1 hidden items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-semibold text-[color:var(--ui-primary)] shadow-sm transition hover:bg-white sm:flex dark:bg-black/20 dark:hover:bg-black/30"
        :aria-label="t('accessibility.liveVoteIndicator')"
      >
        <span class="relative flex size-2.5">
          <span
            class="animate-pulse-live absolute inline-flex size-full rounded-full bg-[color:var(--ui-primary)] opacity-75"
          />
          <span class="relative inline-flex size-2.5 rounded-full bg-[color:var(--ui-primary)]" />
        </span>
        {{ t('nav.live') }}
      </NuxtLink>

      <div class="flex-1" />

      <UDropdownMenu
        :modal="false"
        :items="
          localeItems.map((l) => ({
            label: l.name,
            icon: l.flag,
            onSelect: () => switchLocale(l.code),
          }))
        "
      >
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :icon="currentLocale.flag"
          :aria-label="t('accessibility.changeLanguage')"
          :title="t('accessibility.changeLanguage')"
        />
      </UDropdownMenu>

      <UColorModeButton />

      <template v-if="!session.isPending">
        <UTooltip v-if="session.data" :text="t('nav.admin')">
          <UButton
            :to="localePath('/admin')"
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-tabler-layout-dashboard"
            :aria-label="t('nav.admin')"
          />
        </UTooltip>
        <UTooltip v-else :text="t('nav.login')">
          <UButton
            :to="localePath('/admin/login')"
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-tabler-login"
            :aria-label="t('nav.login')"
          />
        </UTooltip>
      </template>
    </div>
  </header>
</template>
