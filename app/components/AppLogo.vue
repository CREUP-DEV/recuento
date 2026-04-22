<script setup lang="ts">
withDefaults(
  defineProps<{
    class?: string
  }>(),
  {
    class: 'h-8 w-auto',
  }
)

const { t } = useI18n()
</script>

<template>
  <UColorModeImage
    light="/nav/creup-site-header-logo-light.svg"
    dark="/nav/creup-site-header-logo-dark.svg"
    :alt="t('app.title')"
    :class="$props.class"
  />
</template>
