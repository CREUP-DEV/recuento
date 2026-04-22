<script setup lang="ts">
import type { LocalVoteOption } from '~/composables/useLocalVote'

const { t } = useI18n()

const props = defineProps<{
  option: LocalVoteOption
  total: number
  flashing?: boolean
}>()

const emit = defineEmits<{
  increment: []
  decrement: []
  delete: []
  setCount: [count: number]
  updateColor: [color: string | null]
}>()

const colorInput = ref<HTMLInputElement | null>(null)

function onColorChange(e: Event) {
  emit('updateColor', (e.target as HTMLInputElement).value)
}

const countInput = ref(String(props.option.count))
const isEditingCount = ref(false)

watch(
  () => props.option.count,
  (val) => {
    if (!isEditingCount.value) countInput.value = String(val)
  }
)

function confirmCount() {
  const val = parseInt(countInput.value, 10)
  if (!Number.isNaN(val) && val >= 0) emit('setCount', val)
  isEditingCount.value = false
}
</script>

<template>
  <div
    class="space-y-1.5 rounded-xl p-3 transition-colors"
    :class="flashing ? 'bg-primary/8' : 'hover:bg-muted/40'"
  >
    <!-- Label row -->
    <div class="flex items-center gap-2">
      <!-- Color swatch -->
      <button
        type="button"
        class="size-3.5 shrink-0 rounded-full ring-1 ring-transparent transition hover:ring-2 hover:ring-offset-1 focus:outline-none focus-visible:ring-2"
        :style="{
          backgroundColor: option.color ?? 'var(--color-creup-blue-400)',
          '--tw-ring-color': option.color ?? 'var(--color-creup-blue-400)',
        }"
        :aria-label="t('localVote.changeColor')"
        :title="t('localVote.changeColor')"
        @click="colorInput?.click()"
      />
      <input
        ref="colorInput"
        type="color"
        class="sr-only"
        :value="option.color ?? '#93c5fd'"
        @change="onColorChange"
      />

      <span class="flex-1 text-sm font-medium">{{ option.label }}</span>

      <span
        v-if="option.shortcut"
        class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs"
      >
        {{ option.shortcut }}
      </span>

      <!-- Count (click to edit) -->
      <button
        v-if="!isEditingCount"
        type="button"
        class="min-w-8 cursor-pointer bg-transparent text-right font-mono text-sm font-bold tabular-nums"
        :aria-label="t('localVote.editCount')"
        :title="t('localVote.editCount')"
        @click="isEditingCount = true"
      >
        {{ option.count }}
      </button>
      <UInput
        v-else
        v-model="countInput"
        size="xs"
        class="w-16 text-center font-mono"
        type="number"
        min="0"
        @blur="confirmCount"
        @keydown.enter.prevent="confirmCount"
        @keydown.escape.prevent="isEditingCount = false"
      />

      <UButton
        icon="i-tabler-minus"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="option.count <= 0"
        :aria-label="t('admin.decrement')"
        @click="emit('decrement')"
      />
      <UButton
        icon="i-tabler-plus"
        variant="ghost"
        color="neutral"
        size="xs"
        :aria-label="t('admin.increment')"
        @click="emit('increment')"
      />
      <UTooltip
        :text="option.count > 0 ? t('localVote.deleteOptionBlocked') : t('localVote.deleteOption')"
      >
        <UButton
          icon="i-tabler-trash"
          variant="ghost"
          color="error"
          size="xs"
          :disabled="option.count > 0"
          :aria-label="t('localVote.deleteOption')"
          @click="emit('delete')"
        />
      </UTooltip>
    </div>

    <!-- Bar -->
    <VoteBar :count="option.count" :total="total" :color="option.color" />
  </div>
</template>
