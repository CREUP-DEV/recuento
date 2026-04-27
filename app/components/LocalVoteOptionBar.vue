<script setup lang="ts">
import type { LocalVoteOption } from '~/composables/useLocalVote'
import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

const { t } = useI18n()

const props = defineProps<{
  option: LocalVoteOption
  index: number
  total: number
  isFirst: boolean
  isLast: boolean
  locked?: boolean
  flashing?: boolean
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

const colorInput = ref<HTMLInputElement | null>(null)
const countInputElement = ref<HTMLInputElement | null>(null)
const defaultColor = computed(
  () => DEFAULT_OPTION_COLORS[props.index % DEFAULT_OPTION_COLORS.length] ?? '#93c5fd'
)

function openColorPicker() {
  colorInput.value?.showPicker?.()
  colorInput.value?.click()
}

function onColorChange(e: Event) {
  emit('updateColor', (e.target as HTMLInputElement).value)
}

const countInput = ref(String(props.option.count))
const isEditingCount = ref(false)

const canShowReorderControls = computed(() => !props.locked && !(props.isFirst && props.isLast))
const canShowVoteControls = computed(() => Boolean(props.active))
const canShowDelete = computed(() => !props.active)
const canShowColorControls = computed(() => !props.active)

watch(
  () => props.option.count,
  (val) => {
    if (!isEditingCount.value) countInput.value = String(val)
  }
)

function confirmCount() {
  const val = parseInt(countInput.value, 10)
  if (!Number.isNaN(val) && val >= 0) emit('setCount', val)
  countInput.value = String(Number.isNaN(val) || val < 0 ? props.option.count : val)
  isEditingCount.value = false
}

function startEditingCount() {
  if (!props.active) {
    return
  }

  isEditingCount.value = true
}

function cancelCountEdit() {
  countInput.value = String(props.option.count)
  isEditingCount.value = false
}

watch(isEditingCount, async (editing) => {
  if (!editing) {
    return
  }

  await nextTick()
  countInputElement.value?.focus()
  countInputElement.value?.select()
})
</script>

<template>
  <div
    :data-option-id="option.id"
    class="group space-y-1.5 border border-transparent transition-[padding,border-radius,box-shadow,background-color,border-color] duration-220 ease-out"
    :class="[
      active
        ? 'bg-default rounded-xl p-3 shadow-sm'
        : 'bg-default hover:bg-muted/20 rounded-2xl p-4 shadow-sm',
      flashing ? 'bg-primary/8 ring-primary/20 ring-1' : '',
    ]"
  >
    <!-- Label row -->
    <div class="flex items-center gap-2">
      <div v-if="canShowReorderControls" class="flex shrink-0 items-center gap-1.5">
        <div class="flex min-h-18 flex-col justify-center gap-1">
          <UButton
            v-if="!isFirst"
            icon="i-tabler-chevron-up"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('admin.moveOptionUp')"
            :ui="{ base: 'p-1.5' }"
            @click="emit('moveUp')"
          />
          <UButton
            v-if="!isLast"
            icon="i-tabler-chevron-down"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('admin.moveOptionDown')"
            :ui="{ base: 'p-1.5' }"
            @click="emit('moveDown')"
          />
        </div>

        <span
          class="drag-handle text-muted-foreground flex cursor-grab touch-none items-center rounded p-1.5 active:cursor-grabbing"
          :title="t('localVote.reorderOption')"
        >
          <UIcon name="i-tabler-grip-vertical" class="size-4" aria-hidden="true" />
          <span class="sr-only">{{ t('localVote.reorderOption') }}</span>
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-2 self-center">
        <button
          v-if="canShowColorControls"
          type="button"
          class="relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center self-center rounded-full ring-1 ring-transparent transition focus-within:ring-2 hover:ring-2 hover:ring-offset-1"
          :style="{ '--tw-ring-color': option.color ?? defaultColor }"
          :aria-label="t('localVote.changeColor')"
          :title="t('localVote.changeColor')"
          @click.stop="openColorPicker"
        >
          <span
            class="block size-4 rounded-full ring-1 ring-black/5"
            :style="{ backgroundColor: option.color ?? defaultColor }"
            aria-hidden="true"
          />
        </button>
        <input
          v-if="canShowColorControls"
          ref="colorInput"
          type="color"
          class="sr-only"
          aria-hidden="true"
          tabindex="-1"
          :value="option.color ?? defaultColor"
          @change.stop="onColorChange"
        />
        <span
          v-if="!canShowColorControls"
          class="block size-4 shrink-0 self-center rounded-full ring-1 ring-black/5"
          :style="{ backgroundColor: option.color ?? defaultColor }"
          aria-hidden="true"
        />

        <span
          v-if="option.shortcut"
          class="text-muted-foreground shrink-0 font-mono text-xs font-semibold md:hidden"
        >
          {{ `${option.shortcut}.` }}
        </span>
      </div>

      <UButton
        v-if="canShowColorControls && option.color && option.color !== defaultColor"
        icon="i-tabler-refresh"
        variant="ghost"
        color="neutral"
        size="xs"
        :aria-label="t('admin.resetOptionColor')"
        :title="t('admin.resetOptionColor')"
        @click.stop="emit('updateColor', null)"
      />

      <span class="flex-1 text-left text-sm font-medium">{{ option.label }}</span>

      <Transition name="vote-controls" mode="out-in">
        <div v-if="canShowVoteControls" key="vote-controls" class="flex items-center gap-1">
          <UButton
            icon="i-tabler-minus"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="option.count <= 0"
            :aria-label="t('admin.decrement')"
            :ui="{ base: 'transition-transform duration-150 active:scale-90' }"
            @click="emit('decrement')"
          />
          <button
            v-if="!isEditingCount"
            type="button"
            class="inline-flex h-9 w-11 items-center justify-center rounded-md bg-transparent font-mono text-sm font-bold tabular-nums transition-colors hover:bg-black/5"
            :aria-label="t('localVote.editCount')"
            :title="t('localVote.editCount')"
            @click="startEditingCount"
          >
            {{ option.count }}
          </button>
          <input
            v-else
            ref="countInputElement"
            v-model="countInput"
            class="border-default bg-default text-default focus:border-primary/40 focus:ring-primary/10 h-9 w-11 rounded-md border text-center font-mono text-sm font-bold tabular-nums outline-none focus:ring-2"
            type="number"
            min="0"
            inputmode="numeric"
            @blur="confirmCount"
            @keydown.enter.prevent="confirmCount"
            @keydown.escape.prevent="cancelCountEdit"
          />
          <UButton
            icon="i-tabler-plus"
            variant="solid"
            color="primary"
            size="sm"
            :aria-label="t('admin.increment')"
            :aria-keyshortcuts="option.shortcut ?? undefined"
            :ui="{ base: 'transition-transform duration-150 active:scale-90' }"
            @click="emit('increment')"
          />
        </div>
        <div
          v-else
          key="count-display"
          class="bg-muted/70 min-w-12 rounded-full px-3 py-1 text-center font-mono text-sm font-bold tabular-nums"
        >
          {{ option.count }}
        </div>
      </Transition>

      <UTooltip v-if="canShowDelete" :text="t('localVote.deleteOption')">
        <UButton
          icon="i-tabler-trash"
          variant="ghost"
          color="error"
          size="sm"
          :aria-label="t('localVote.deleteOption')"
          :ui="{ base: 'transition-transform duration-150 active:scale-90' }"
          @click="emit('delete')"
        />
      </UTooltip>
    </div>

    <!-- Bar -->
    <VoteBar :count="option.count" :total="total" :color="option.color ?? defaultColor" />
  </div>
</template>
