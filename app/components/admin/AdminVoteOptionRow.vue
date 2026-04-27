<script setup lang="ts">
import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

const { t } = useI18n()

interface VoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
}

const props = defineProps<{
  option: VoteOption
  flashing?: boolean
  index: number
  total: number
  isFirst: boolean
  isLast: boolean
  locked?: boolean
  active?: boolean
}>()

const emit = defineEmits<{
  increment: []
  decrement: []
  delete: []
  setCount: [count: number]
  updateColor: [color: string | null]
  moveUp: []
  moveDown: []
}>()

const defaultColor = computed(
  () => DEFAULT_OPTION_COLORS[props.index % DEFAULT_OPTION_COLORS.length] ?? '#93c5fd'
)

const colorInput = ref<HTMLInputElement | null>(null)

function openColorPicker() {
  colorInput.value?.click()
}

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

function confirmSetCount() {
  const val = parseInt(countInput.value, 10)
  if (!Number.isNaN(val) && val >= 0) emit('setCount', val)
  isEditingCount.value = false
}
</script>

<template>
  <div
    class="border-default space-y-2 rounded-lg border p-3 transition"
    :class="flashing ? 'bg-primary/10' : 'hover:bg-muted/50'"
  >
    <div class="flex items-center gap-3">
      <div class="flex flex-col gap-0.5">
        <UButton
          icon="i-tabler-chevron-up"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="isFirst || locked"
          :aria-label="t('admin.moveOptionUp')"
          :ui="{ base: 'p-0.5' }"
          @click="emit('moveUp')"
        />
        <UButton
          icon="i-tabler-chevron-down"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="isLast || locked"
          :aria-label="t('admin.moveOptionDown')"
          :ui="{ base: 'p-0.5' }"
          @click="emit('moveDown')"
        />
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <div class="relative shrink-0">
          <button
            type="button"
            class="size-5 rounded ring-1 ring-transparent transition hover:ring-2 hover:ring-offset-1 focus:outline-none focus-visible:ring-2"
            :style="{
              backgroundColor: option.color ?? defaultColor,
              '--tw-ring-color': option.color ?? defaultColor,
            }"
            :disabled="locked"
            :aria-label="t('admin.changeColor')"
            :title="t('admin.changeColor')"
            @click="openColorPicker"
          />
          <input
            ref="colorInput"
            type="color"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            :value="option.color ?? defaultColor"
            @change="onColorChange"
          />
        </div>

        <span
          v-if="option.shortcut"
          class="text-muted-foreground shrink-0 font-mono text-xs font-semibold md:hidden"
        >
          {{ `${option.shortcut}.` }}
        </span>
      </div>

      <UButton
        v-if="option.color && option.color !== defaultColor"
        icon="i-tabler-refresh"
        variant="ghost"
        color="neutral"
        size="xs"
        :aria-label="t('admin.resetOptionColor')"
        :title="t('admin.resetOptionColor')"
        :disabled="locked"
        @click="emit('updateColor', null)"
      />

      <span class="flex-1 text-left text-sm font-medium">{{ option.label }}</span>

      <div class="flex items-center gap-1">
        <UButton
          icon="i-tabler-minus"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="!active || option.count <= 0"
          :aria-label="t('admin.decrementVote')"
          @click="emit('decrement')"
        />
        <button
          v-if="!isEditingCount"
          type="button"
          class="min-w-8 cursor-pointer bg-transparent text-center font-mono text-sm font-bold tabular-nums"
          :aria-label="t('admin.editCount')"
          :title="t('admin.editCount')"
          :disabled="!active"
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
          :disabled="!active"
          @blur="confirmSetCount"
          @keydown.enter.prevent="confirmSetCount"
          @keydown.escape.prevent="isEditingCount = false"
        />
        <UButton
          icon="i-tabler-plus"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="!active"
          :aria-label="t('admin.incrementOption', { option: option.label })"
          :aria-keyshortcuts="option.shortcut ?? undefined"
          @click="emit('increment')"
        />
      </div>

      <UButton
        icon="i-tabler-trash"
        variant="ghost"
        color="error"
        size="xs"
        :disabled="locked"
        :aria-label="t('admin.deleteOption')"
        @click="emit('delete')"
      />
    </div>

    <VoteBar :count="option.count" :total="total" :color="option.color ?? defaultColor" />
  </div>
</template>
