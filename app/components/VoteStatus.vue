<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  open: boolean
  startedAt?: string | null
  endedAt?: string | null
}>()

const status = computed(() => {
  if (props.open) return 'open'
  if (props.endedAt) return 'closed'
  return 'pending'
})
</script>

<template>
  <UBadge
    :color="status === 'open' ? 'success' : status === 'closed' ? 'neutral' : 'info'"
    :variant="status === 'open' ? 'solid' : 'subtle'"
    class="inline-flex items-center gap-1.5"
  >
    <span v-if="status === 'open'" class="relative flex size-2">
      <span
        class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-300 opacity-75"
      />
      <span class="relative inline-flex size-2 rounded-full bg-green-100" />
    </span>
    {{ t(`votes.${status}`) }}
  </UBadge>
</template>
