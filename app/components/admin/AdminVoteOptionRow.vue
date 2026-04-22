<script setup lang="ts">
import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

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
  isFirst: boolean
  isLast: boolean
  locked?: boolean
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
  () => DEFAULT_OPTION_COLORS[props.index % DEFAULT_OPTION_COLORS.length]
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
    class="border-default flex items-center gap-3 rounded-lg border p-3 transition"
    :class="flashing ? 'bg-primary/10' : 'hover:bg-muted/50'"
  >
    <!-- Reorder buttons -->
    <div class="flex flex-col gap-0.5">
      <UButton
        icon="i-tabler-chevron-up"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="isFirst || locked"
        aria-label="Mover opción arriba"
        :ui="{ base: 'p-0.5' }"
        @click="emit('moveUp')"
      />
      <UButton
        icon="i-tabler-chevron-down"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="isLast || locked"
        aria-label="Mover opción abajo"
        :ui="{ base: 'p-0.5' }"
        @click="emit('moveDown')"
      />
    </div>

    <!-- Color swatch + hidden input -->
    <div class="relative shrink-0">
      <button
        type="button"
        class="size-5 rounded ring-1 ring-transparent transition hover:ring-2 hover:ring-offset-1 focus:outline-none focus-visible:ring-2"
        :style="{
          backgroundColor: option.color ?? defaultColor,
          '--tw-ring-color': option.color ?? defaultColor,
        }"
        :disabled="locked"
        aria-label="Cambiar color"
        title="Cambiar color"
        @click="openColorPicker"
      />
      <input
        ref="colorInput"
        type="color"
        class="sr-only"
        :value="option.color ?? defaultColor"
        @change="onColorChange"
      />
    </div>

    <!-- Reset color to default -->
    <UButton
      v-if="option.color && option.color !== defaultColor"
      icon="i-tabler-refresh"
      variant="ghost"
      color="neutral"
      size="xs"
      aria-label="Restaurar color por defecto"
      title="Restaurar color por defecto"
      :disabled="locked"
      @click="emit('updateColor', null)"
    />

    <span class="flex-1 text-sm font-medium">{{ option.label }}</span>

    <span
      v-if="option.shortcut"
      class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs"
    >
      {{ option.shortcut }}
    </span>

    <div class="flex items-center gap-1">
      <UButton
        icon="i-tabler-minus"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="option.count <= 0"
        aria-label="Restar un voto"
        @click="emit('decrement')"
      />
      <button
        v-if="!isEditingCount"
        type="button"
        class="min-w-8 cursor-pointer bg-transparent text-center font-mono text-sm font-bold tabular-nums"
        aria-label="Editar recuento"
        title="Clic para editar"
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
        @blur="confirmSetCount"
        @keydown.enter.prevent="confirmSetCount"
        @keydown.escape.prevent="isEditingCount = false"
      />
      <UButton
        icon="i-tabler-plus"
        variant="ghost"
        color="neutral"
        size="xs"
        aria-label="Sumar un voto"
        @click="emit('increment')"
      />
    </div>

    <UButton
      icon="i-tabler-trash"
      variant="ghost"
      color="error"
      size="xs"
      :disabled="locked"
      aria-label="Eliminar opción"
      @click="emit('delete')"
    />
  </div>
</template>
