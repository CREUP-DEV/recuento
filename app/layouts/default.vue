<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="bg-background flex min-h-screen flex-col">
    <a href="#main-content" class="skip-link">{{ t('accessibility.skipToMain') }}</a>
    <a href="#main-navigation" class="skip-link">{{ t('accessibility.skipToNavigation') }}</a>

    <AppHeader />

    <UMain id="main-content" tabindex="-1" class="flex-1">
      <slot />
    </UMain>

    <BackToLiveButton />

    <AppFooter />
  </div>
</template>
