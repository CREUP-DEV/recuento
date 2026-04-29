<script setup lang="ts">
const props = defineProps<{
  count: number
  total: number
  color: string | null
  thresholdReached?: boolean
  isWinner?: boolean
  tall?: boolean
}>()

const pct = computed(() => (props.total > 0 ? (props.count / props.total) * 100 : 0))

const barStyle = computed(() => ({
  width: `${pct.value}%`,
  backgroundColor: props.color ?? 'var(--color-creup-blue-400)',
  minWidth: props.count > 0 ? '0.25rem' : '0',
}))
</script>

<template>
  <div
    class="bg-muted overflow-hidden rounded-lg transition-shadow duration-300"
    :class="[
      tall ? 'h-10' : 'h-8',
      { 'ring-2 ring-green-500 ring-offset-1': thresholdReached && !isWinner },
      { 'ring-2 ring-amber-400 ring-offset-1': isWinner },
    ]"
    aria-hidden="true"
  >
    <div
      class="h-full rounded-lg transition-[width,min-width,background-color] duration-500 ease-out"
      :style="barStyle"
    />
  </div>
</template>
