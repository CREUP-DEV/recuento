<script setup lang="ts">
import draggable from 'vuedraggable'
import { SUGGESTED_OPTION_LABEL_KEYS } from '~~/shared/constants/voteOptions'
import {
  buildVoteResultsText,
  getMobileOptionButtonStyle,
  getOptionSuggestionLabels,
  getOptionDisplayColor,
} from '~~/shared/utils/votePresentation'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { copy } = useClipboard()
const { launchConfetti } = useConfetti()
const { listContainerRef: closedOptionsContainerRef, animateLayoutChange } = useListFlipAnimation()

useSeoMeta({ title: () => t('localVote.title'), robots: 'noindex' })

const {
  state,
  totalVotes,
  canUndo,
  canRedo,
  addOption,
  removeOption,
  incrementOption,
  decrementOption,
  setCount,
  updateColor,
  updateCanWin,
  setMinimumVotes,
  setMaxWinners,
  resetCounts,
  clearAll,
  reorderOptions,
  undoLastVote,
  redoLastVote,
} = useLocalVote()

const settingsMinimumVotes = ref<string>(
  state.value.minimumVotes !== null ? String(state.value.minimumVotes) : ''
)
const settingsMaxWinners = ref<string>(
  state.value.maxWinners !== null ? String(state.value.maxWinners) : ''
)

watch(
  () => state.value.minimumVotes,
  (val) => {
    settingsMinimumVotes.value = val !== null ? String(val) : ''
  }
)
watch(
  () => state.value.maxWinners,
  (val) => {
    settingsMaxWinners.value = val !== null ? String(val) : ''
  }
)

function applyMinimumVotes(raw: string | number) {
  const str = String(raw)
  const parsed = str.trim() === '' ? null : parseInt(str, 10)
  if (parsed !== null && (Number.isNaN(parsed) || parsed < 1)) return
  setMinimumVotes(parsed)
}

function applyMaxWinners(raw: string | number) {
  const str = String(raw)
  const parsed = str.trim() === '' ? null : parseInt(str, 10)
  if (parsed !== null && (Number.isNaN(parsed) || parsed < 1)) return
  setMaxWinners(parsed)
}

function getThresholdReached(optionId: string, count: number, canWin: boolean) {
  return state.value.minimumVotes !== null && canWin && count >= state.value.minimumVotes
}

const localWinners = computed(() => {
  if (state.value.open) return new Set<string>()
  return calculateWinners(
    state.value.options.map((o) => ({ id: o.id, count: o.count, canWin: o.canWin })),
    state.value.minimumVotes,
    state.value.maxWinners
  ).winnerIds
})

const { flashingOptionId, flashOption } = useVoteKeyboard(
  computed(() => state.value.options),
  incrementOption,
  computed(() => state.value.open),
  undoLastVote,
  redoLastVote
)

function incrementAndFlash(optionId: string) {
  incrementOption(optionId)
  flashOption(optionId)
}

function decrementAndFlash(optionId: string) {
  const option = state.value.options.find((entry) => entry.id === optionId)
  if (!option || option.count <= 0) return
  decrementOption(optionId)
  flashOption(optionId)
}

const isEditingName = ref(false)
const nameInput = ref(state.value.name)

function confirmName() {
  if (nameInput.value.trim()) state.value.name = nameInput.value.trim()
  else nameInput.value = state.value.name
  isEditingName.value = false
}

const newOptionLabel = ref('')
const showResetConfirm = ref(false)
const pendingDeleteOptionId = ref<string | null>(null)

function addOptionAndReset() {
  if (!newOptionLabel.value.trim()) return
  addOption(newOptionLabel.value.trim())
  newOptionLabel.value = ''
}

function addSuggestedOption(label: string) {
  addOption(label)
  newOptionLabel.value = ''
}

async function moveOption(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= state.value.options.length) {
    return
  }

  const reordered = [...state.value.options]
  const [moved] = reordered.splice(fromIndex, 1)

  if (!moved) {
    return
  }

  reordered.splice(toIndex, 0, moved)

  await animateLayoutChange(() => {
    reorderOptions(reordered)
  })
}

function onOptionsReorder(event: { moved?: { oldIndex: number; newIndex: number } }) {
  if (!event.moved) {
    return
  }

  reorderOptions([...state.value.options])
}

function triggerUndo() {
  const optionId = undoLastVote()

  if (optionId) {
    flashOption(optionId)
  }
}

function triggerRedo() {
  const optionId = redoLastVote()

  if (optionId) {
    flashOption(optionId)
  }
}

const localConfettiEnabled = useLocalStorage('recuento-local-confetti', true)
const settingsOpen = ref(true)

type LocalVotePhase = 'setup' | 'voting' | 'results' | 'closedEmpty'
const phase = computed((): LocalVotePhase => {
  if (state.value.open) return 'voting'
  if (totalVotes.value > 0) return 'results'
  if (state.value.options.length > 0) return 'closedEmpty'
  return 'setup'
})

watch(
  () => state.value.open,
  (open) => {
    if (open) {
      settingsOpen.value = false
    }
  }
)

function toggleVoteOpen() {
  const wasOpen = state.value.open
  state.value.open = !state.value.open
  if (wasOpen && localConfettiEnabled.value && localWinners.value.size > 0) {
    launchConfetti()
  }
}

const pendingDeleteOption = computed(
  () => state.value.options.find((option) => option.id === pendingDeleteOptionId.value) ?? null
)

function confirmDeleteOption(optionId: string) {
  pendingDeleteOptionId.value = optionId
}

function executeDeleteOption() {
  if (!pendingDeleteOptionId.value) {
    return
  }

  removeOption(pendingDeleteOptionId.value)
  pendingDeleteOptionId.value = null
}

const showClearConfirm = ref(false)
const suggestedOptionLabels = computed(() =>
  getOptionSuggestionLabels(t, SUGGESTED_OPTION_LABEL_KEYS[state.value.options.length])
)

const activeShortcuts = computed(() =>
  state.value.options
    .map((option) => option.shortcut)
    .filter((shortcut): shortcut is string => Boolean(shortcut))
)

async function copyResults() {
  try {
    await copy(
      buildVoteResultsText(
        state.value.name,
        t('localVote.totalEmitted'),
        totalVotes.value,
        state.value.options
      )
    )
    toast.add({ title: t('localVote.copySuccess'), color: 'success' })
  } catch {
    toast.add({ title: t('localVote.copyError'), color: 'error' })
  }
}
</script>

<template>
  <div
    class="animate-fade-slide-up mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"
    :class="state.open && state.options.length > 0 ? 'pb-32 md:pb-12' : ''"
  >
    <!-- Back to home -->
    <div class="mb-4">
      <NuxtLink
        :to="localePath('/')"
        class="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <UIcon name="i-tabler-arrow-left" class="size-4" />
        {{ t('nav.home') }}
      </NuxtLink>
    </div>

    <!-- Header -->
    <div class="mb-5 flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <!-- Editable name -->
        <h1
          v-if="!isEditingName"
          class="font-heading text-3xl font-bold tracking-tight sm:text-4xl"
        >
          <button
            type="button"
            class="focus-visible:ring-primary/60 group inline-flex items-center gap-2 rounded-sm bg-transparent text-left focus-visible:ring-2 focus-visible:outline-none"
            :aria-label="t('localVote.editName')"
            :title="t('localVote.editName')"
            @click="
              () => {
                nameInput = state.name
                isEditingName = true
              }
            "
          >
            <span
              class="border-b-2 border-dashed border-transparent pb-0.5 transition-colors group-hover:border-current"
            >
              {{ state.name }}
            </span>
            <UIcon name="i-tabler-pencil" class="text-muted size-5 shrink-0 opacity-100" />
          </button>
        </h1>
        <UInput
          v-else
          v-model="nameInput"
          size="xl"
          class="text-2xl font-bold"
          autofocus
          @blur="confirmName"
          @keydown.enter.prevent="confirmName"
          @keydown.escape.prevent="
            () => {
              nameInput = state.name
              isEditingName = false
            }
          "
        />

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-muted flex items-center gap-1 text-sm">
            <UIcon name="i-tabler-device-floppy" class="size-4 shrink-0" aria-hidden="true" />
            {{ t('localVote.description') }}
          </span>
        </div>
      </div>

      <!-- Total -->
      <div v-if="phase === 'voting' || phase === 'results'" class="shrink-0 text-right">
        <p class="text-muted text-base">{{ t('localVote.total') }}</p>
        <p class="font-mono text-4xl font-bold tabular-nums">{{ totalVotes }}</p>
      </div>
    </div>

    <!-- Vote settings (accordion) -->
    <div v-if="phase !== 'results'" class="border-default mb-6 rounded-xl border">
      <button
        type="button"
        class="flex w-full items-center justify-between px-4 py-3 text-left"
        :aria-expanded="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <span class="text-muted text-sm font-semibold tracking-wide uppercase">
          {{ t('admin.voteSettings') }}
        </span>
        <UIcon
          name="i-tabler-chevron-down"
          class="text-muted size-4 shrink-0 transition-transform duration-200"
          :class="settingsOpen ? 'rotate-180' : ''"
        />
      </button>
      <div
        class="grid transition-[grid-template-rows] duration-300 ease-in-out"
        :class="settingsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div class="overflow-hidden">
          <div class="px-4 pb-4" :class="state.open ? 'pointer-events-none opacity-60' : ''">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-muted text-sm font-medium" for="local-min-votes">
                  {{ t('localVote.minimumVotes') }}
                </label>
                <UInput
                  id="local-min-votes"
                  v-model="settingsMinimumVotes"
                  type="number"
                  min="1"
                  size="sm"
                  :placeholder="t('localVote.minimumVotesPlaceholder')"
                  @blur="applyMinimumVotes(settingsMinimumVotes)"
                  @keydown.enter.prevent="applyMinimumVotes(settingsMinimumVotes)"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-muted text-sm font-medium" for="local-max-winners">
                  {{ t('localVote.maxWinners') }}
                </label>
                <UInput
                  id="local-max-winners"
                  v-model="settingsMaxWinners"
                  type="number"
                  min="1"
                  size="sm"
                  :placeholder="t('localVote.maxWinnersPlaceholder')"
                  @blur="applyMaxWinners(settingsMaxWinners)"
                  @keydown.enter.prevent="applyMaxWinners(settingsMaxWinners)"
                />
              </div>
            </div>
            <p class="text-muted mt-3 text-xs">{{ t('admin.canWinHelp') }}</p>
            <div class="border-default mt-3 flex items-center gap-3 border-t pt-3">
              <USwitch v-model="localConfettiEnabled" :aria-label="t('admin.confettiEnabled')" />
              <div>
                <p class="text-sm font-medium">{{ t('admin.confettiEnabled') }}</p>
                <p class="text-muted text-xs">{{ t('admin.confettiEnabledHelp') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Winners (results phase only) -->
    <div
      v-if="phase === 'results' && localWinners.size > 0"
      class="border-default mb-6 rounded-xl border p-4"
    >
      <p class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
        {{ t('votes.winners') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="option in state.options.filter((o) => localWinners.has(o.id))"
          :key="option.id"
          class="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        >
          <UIcon name="i-tabler-trophy" class="size-3.5" />
          {{ option.label }}
        </span>
      </div>
    </div>

    <!-- Options -->
    <div
      class="border-default bg-default relative mb-6 overflow-hidden rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200"
      :class="state.open ? 'border-primary/20 shadow-sm' : 'shadow-sm'"
    >
      <div
        v-if="state.options.length > 0"
        ref="closedOptionsContainerRef"
        class="relative z-10 p-3 sm:p-4"
      >
        <p
          v-if="phase === 'setup' || phase === 'closedEmpty'"
          class="text-muted mb-3 flex items-start gap-2 text-sm"
        >
          <UIcon name="i-tabler-toggle-right" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{{ t('localVote.optionSwitchHelp') }}</span>
        </p>
        <draggable
          :list="state.options"
          item-key="id"
          tag="div"
          :class="state.open ? 'space-y-2' : 'space-y-3'"
          handle=".drag-handle"
          :disabled="state.open || phase === 'results'"
          drag-class="vote-dragging"
          ghost-class="vote-drag-ghost"
          animation="180"
          @change="onOptionsReorder"
        >
          <template #item="{ element: option, index }">
            <VoteOptionRow
              :option="option"
              :index="index"
              :total="totalVotes"
              :is-first="index === 0"
              :is-last="index === state.options.length - 1"
              :locked="state.open"
              :active="state.open"
              :flashing="flashingOptionId === option.id"
              :threshold-reached="getThresholdReached(option.id, option.count, option.canWin)"
              :is-winner="localWinners.has(option.id)"
              :results-mode="phase === 'results'"
              :hide-count="phase === 'setup' || phase === 'closedEmpty'"
              :hide-progress="phase === 'setup' || phase === 'closedEmpty'"
              size="md"
              @delete="confirmDeleteOption(option.id)"
              @increment="incrementAndFlash(option.id)"
              @decrement="decrementAndFlash(option.id)"
              @set-count="(count) => setCount(option.id, count)"
              @update-color="(color) => updateColor(option.id, color)"
              @update-can-win="(canWin) => updateCanWin(option.id, canWin)"
              @move-up="moveOption(index, index - 1)"
              @move-down="moveOption(index, index + 1)"
            />
          </template>
        </draggable>
      </div>
      <div v-if="state.options.length === 0" class="relative z-10 py-12 text-center">
        <UIcon name="i-tabler-chart-bar-off" class="text-muted mx-auto size-10" />
        <p class="text-muted mt-3 text-sm">{{ t('localVote.empty') }}</p>
      </div>

      <!-- Add option -->
      <div
        v-if="phase === 'setup' || phase === 'closedEmpty'"
        class="border-default relative z-10 border-t p-4"
      >
        <div class="flex gap-2">
          <UInput
            v-model="newOptionLabel"
            :placeholder="t('localVote.newOptionPlaceholder')"
            class="flex-1"
            @keydown.enter.prevent="addOptionAndReset"
          />
          <UButton
            icon="i-tabler-plus"
            color="primary"
            :disabled="!newOptionLabel.trim()"
            @click="addOptionAndReset"
          >
            {{ t('localVote.addOption') }}
          </UButton>
        </div>

        <div v-if="suggestedOptionLabels.length > 0" class="mt-3 space-y-2">
          <p class="text-muted text-xs font-medium">{{ t('voteOptions.suggestionLabel') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="label in suggestedOptionLabels"
              :key="label"
              size="xs"
              variant="soft"
              color="neutral"
              @click="addSuggestedOption(label)"
            >
              {{ label }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Open/close toggle — always visible except in results (read-only) -->
      <UButton
        v-if="phase !== 'results'"
        :icon="state.open ? 'i-tabler-player-stop' : 'i-tabler-player-play'"
        :color="state.open ? 'error' : 'success'"
        variant="subtle"
        class="transition-transform duration-200 active:scale-95"
        @click="toggleVoteOpen"
      >
        {{ state.open ? t('localVote.close') : t('localVote.open') }}
      </UButton>

      <!-- Undo / Redo — only during voting -->
      <Transition name="vote-controls">
        <div v-if="phase === 'voting'" class="hidden md:inline-flex">
          <UButton
            icon="i-tabler-arrow-back-up"
            variant="subtle"
            color="neutral"
            :disabled="!canUndo"
            aria-keyshortcuts="Backspace"
            @click="triggerUndo"
          >
            {{ t('localVote.undoLastVote') }}
          </UButton>
        </div>
      </Transition>

      <Transition name="vote-controls">
        <div v-if="phase === 'voting'" class="hidden md:inline-flex">
          <UButton
            icon="i-tabler-arrow-forward-up"
            variant="subtle"
            color="neutral"
            :disabled="!canRedo"
            aria-keyshortcuts="Shift+Backspace"
            @click="triggerRedo"
          >
            {{ t('localVote.redoLastVote') }}
          </UButton>
        </div>
      </Transition>

      <!-- Results phase actions -->
      <template v-if="phase === 'results'">
        <UButton
          icon="i-tabler-player-play"
          color="success"
          variant="subtle"
          class="transition-transform duration-200 active:scale-95"
          @click="toggleVoteOpen"
        >
          {{ t('localVote.reopen') }}
        </UButton>

        <UButton icon="i-tabler-copy" variant="subtle" color="neutral" @click="copyResults">
          {{ t('localVote.copyResults') }}
        </UButton>

        <UButton
          icon="i-tabler-rotate"
          variant="subtle"
          color="neutral"
          @click="showResetConfirm = true"
        >
          {{ t('localVote.resetCounts') }}
        </UButton>

        <UButton
          icon="i-tabler-trash"
          variant="subtle"
          color="error"
          @click="showClearConfirm = true"
        >
          {{ t('localVote.clearAll') }}
        </UButton>
      </template>

      <!-- Setup / closedEmpty actions -->
      <template v-if="phase === 'setup' || phase === 'closedEmpty'">
        <UButton
          icon="i-tabler-copy"
          variant="subtle"
          color="neutral"
          :disabled="state.options.length === 0"
          @click="copyResults"
        >
          {{ t('localVote.copyResults') }}
        </UButton>

        <UButton
          icon="i-tabler-trash"
          variant="subtle"
          color="error"
          @click="showClearConfirm = true"
        >
          {{ t('localVote.clearAll') }}
        </UButton>
      </template>

      <!-- Keyboard hint — only during voting -->
      <span
        v-if="phase === 'voting' && activeShortcuts.length > 0"
        class="text-muted ml-auto hidden items-center gap-4 text-sm md:flex"
      >
        <span class="flex items-center gap-1.5">
          <UIcon name="i-tabler-keyboard" class="size-3.5" />
          {{ t('localVote.keyboardHint') }}
          <span v-for="shortcut in activeShortcuts" :key="shortcut">
            <kbd class="bg-muted rounded px-1 py-0.5 font-mono">{{ shortcut }}</kbd>
          </span>
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="bg-muted rounded px-1.5 py-0.5 font-mono">⌫</kbd>
          {{ t('localVote.undoHint') }}
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="bg-muted rounded px-1 py-0.5 font-mono">⇧</kbd>
          <kbd class="bg-muted rounded px-1.5 py-0.5 font-mono">⌫</kbd>
          {{ t('localVote.redoHint') }}
        </span>
      </span>
    </div>

    <Teleport to="body">
      <Transition name="vote-float">
        <div v-if="state.open && state.options.length > 0" class="md:hidden">
          <div
            class="border-default bg-default/95 fixed inset-x-4 bottom-4 z-40 rounded-2xl border p-3 shadow-lg backdrop-blur"
          >
            <div class="flex flex-wrap justify-center gap-2">
              <button
                v-for="(option, index) in state.options"
                :key="option.id"
                type="button"
                class="focus-visible:outline-primary flex size-14 items-center justify-center rounded-xl text-base font-bold shadow-sm transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
                :style="getMobileOptionButtonStyle(getOptionDisplayColor(option.color, index))"
                :aria-label="t('localVote.incrementOption', { option: option.label })"
                :aria-keyshortcuts="option.shortcut ?? undefined"
                :title="option.label"
                @click="incrementAndFlash(option.id)"
              >
                <span aria-hidden="true">{{ option.shortcut ?? '?' }}</span>
              </button>

              <div class="flex gap-2">
                <button
                  type="button"
                  class="bg-inverted text-inverted focus-visible:outline-primary flex size-14 items-center justify-center rounded-xl shadow-sm transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canUndo"
                  :aria-label="t('localVote.undoLastVote')"
                  :title="t('localVote.undoLastVote')"
                  @click="triggerUndo"
                >
                  <UIcon name="i-tabler-arrow-back-up" class="size-5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="bg-inverted text-inverted focus-visible:outline-primary flex size-14 items-center justify-center rounded-xl shadow-sm transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canRedo"
                  :aria-label="t('localVote.redoLastVote')"
                  :title="t('localVote.redoLastVote')"
                  @click="triggerRedo"
                >
                  <UIcon name="i-tabler-arrow-forward-up" class="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <UModal v-model:open="showResetConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('localVote.resetTitle') }}</h3>
          <p class="text-muted mt-2">{{ t('localVote.resetDescription') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showResetConfirm = false">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton
              color="error"
              @click="
                () => {
                  resetCounts()
                  showResetConfirm = false
                }
              "
            >
              {{ t('localVote.resetCounts') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="pendingDeleteOptionId !== null" @update:open="pendingDeleteOptionId = null">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('localVote.deleteOption') }}</h3>
          <p class="text-muted mt-2">
            {{ t('localVote.deleteOptionMessage', { name: pendingDeleteOption?.label ?? '' }) }}
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="pendingDeleteOptionId = null">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton color="error" @click="executeDeleteOption">
              {{ t('admin.delete') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Clear confirm modal -->
    <UModal v-model:open="showClearConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('localVote.clearTitle') }}</h3>
          <p class="text-muted mt-2">{{ t('localVote.clearDescription') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showClearConfirm = false">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton
              color="error"
              @click="
                () => {
                  clearAll()
                  showClearConfirm = false
                }
              "
            >
              {{ t('localVote.clearAll') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
