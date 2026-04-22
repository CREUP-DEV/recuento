<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5"
    :aria-label="t('accessibility.liveVoteIndicator')"
    role="status"
  >
    <span class="relative flex size-2">
      <span
        class="animate-pulse-live bg-creup-red-500 absolute inline-flex size-full rounded-full opacity-75"
      />
      <span class="bg-creup-red-600 relative inline-flex size-2 rounded-full" />
    </span>
    <span
      class="text-creup-red-600 dark:text-creup-red-400 text-xs font-bold tracking-wider uppercase"
    >
      {{ t('nav.live') }}
    </span>
  </span>
</template>
