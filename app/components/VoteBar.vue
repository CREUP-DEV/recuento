<script setup lang="ts">
const props = defineProps<{
  count: number
  total: number
  color: string | null
}>()

const pct = computed(() => (props.total > 0 ? (props.count / props.total) * 100 : 0))
</script>

<template>
  <div class="bg-muted h-8 overflow-hidden rounded-lg">
    <div
      class="flex h-full items-center rounded-lg px-3 transition-all duration-500 ease-out"
      :style="{
        width: `${pct}%`,
        backgroundColor: color ?? 'var(--color-creup-blue-400)',
        minWidth: count > 0 ? '2rem' : '0',
      }"
    />
  </div>
</template>
