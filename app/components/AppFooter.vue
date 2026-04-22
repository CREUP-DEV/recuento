<script setup lang="ts">
const { t } = useI18n()
const socials = useSocials()
const year = new Date().getFullYear()
</script>

<template>
  <UFooter>
    <template #left>
      <div class="flex flex-wrap items-center justify-center gap-1 lg:justify-start">
        <UTooltip v-for="social in socials" :key="social.label" :text="social.label">
          <UButton
            :icon="social.icon"
            color="neutral"
            variant="ghost"
            :to="social.to"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="social.label"
          />
        </UTooltip>
      </div>
    </template>

    <p class="text-muted text-center text-xs">{{ t('footer.org') }} · {{ year }}</p>

    <template #right>
      <div class="flex w-full items-center justify-center lg:justify-end">
        <UButton
          icon="i-tabler-brand-github"
          color="neutral"
          variant="ghost"
          to="https://github.com/CREUP-DEV/recuento"
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          :aria-label="t('footer.github')"
        >
          {{ t('footer.github') }}
        </UButton>
      </div>
    </template>
  </UFooter>
</template>
