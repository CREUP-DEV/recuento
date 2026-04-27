<script setup lang="ts">
import { SUGGESTED_OPTION_LABEL_KEYS } from '~~/shared/constants/voteOptions'
import {
  buildVoteResultsText,
  getMobileOptionButtonStyle,
  getOptionSuggestionLabels,
  getOptionDisplayColor,
} from '~~/shared/utils/votePresentation'

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()

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
  resetCounts,
  clearAll,
  undoLastVote,
  redoLastVote,
} = useLocalVote()

const { flashingOptionId, flashOption } = useVoteKeyboard(
  computed(() => state.value.options),
  incrementOption,
  computed(() => state.value.open),
  undoLastVote,
  redoLastVote
)

const isEditingName = ref(false)
const nameInput = ref(state.value.name)

function confirmName() {
  if (nameInput.value.trim()) state.value.name = nameInput.value.trim()
  else nameInput.value = state.value.name
  isEditingName.value = false
}

const newOptionLabel = ref('')
const showResetConfirm = ref(false)

function addOptionAndReset() {
  if (!newOptionLabel.value.trim()) return
  addOption(newOptionLabel.value.trim())
  newOptionLabel.value = ''
}

function addSuggestedOption(label: string) {
  addOption(label)
  newOptionLabel.value = ''
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
    <!-- Header -->
    <div class="mb-8 flex items-start justify-between gap-4">
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

        <div class="mt-3 flex items-center gap-3">
          <VoteStatus :open="state.open" />
        </div>
      </div>

      <!-- Total -->
      <div class="shrink-0 text-right">
        <p class="text-muted text-sm">{{ t('localVote.total') }}</p>
        <p class="font-mono text-3xl font-bold tabular-nums">{{ totalVotes }}</p>
      </div>
    </div>

    <!-- Options -->
    <div class="border-default bg-default mb-6 overflow-hidden rounded-2xl border shadow-sm">
      <div v-if="state.options.length > 0" class="divide-default divide-y">
        <LocalVoteOptionBar
          v-for="option in state.options"
          :key="option.id"
          :option="option"
          :total="totalVotes"
          :active="state.open"
          :flashing="flashingOptionId === option.id"
          @increment="incrementOption(option.id)"
          @decrement="decrementOption(option.id)"
          @delete="removeOption(option.id)"
          @set-count="(count) => setCount(option.id, count)"
          @update-color="(color) => updateColor(option.id, color)"
        />
      </div>
      <div v-else class="py-12 text-center">
        <UIcon name="i-tabler-chart-bar-off" class="text-muted mx-auto size-10" />
        <p class="text-muted mt-3 text-sm">{{ t('localVote.empty') }}</p>
      </div>

      <!-- Add option -->
      <div v-if="!state.open" class="border-default border-t p-4">
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
      <UButton
        :icon="state.open ? 'i-tabler-player-stop' : 'i-tabler-player-play'"
        :color="state.open ? 'error' : 'success'"
        variant="subtle"
        @click="state.open = !state.open"
      >
        {{ state.open ? t('localVote.close') : t('localVote.open') }}
      </UButton>

      <UButton
        icon="i-tabler-arrow-back-up"
        variant="subtle"
        color="neutral"
        class="hidden md:inline-flex"
        :disabled="!canUndo"
        aria-keyshortcuts="Backspace"
        @click="triggerUndo"
      >
        {{ t('localVote.undoLastVote') }}
      </UButton>

      <UButton
        icon="i-tabler-arrow-forward-up"
        variant="subtle"
        color="neutral"
        class="hidden md:inline-flex"
        :disabled="!canRedo"
        aria-keyshortcuts="Shift+Backspace"
        @click="triggerRedo"
      >
        {{ t('localVote.redoLastVote') }}
      </UButton>

      <UButton
        icon="i-tabler-rotate"
        variant="subtle"
        color="neutral"
        :disabled="totalVotes === 0"
        @click="showResetConfirm = true"
      >
        {{ t('localVote.resetCounts') }}
      </UButton>

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

      <!-- Keyboard hint -->
      <span
        v-if="state.open && activeShortcuts.length > 0"
        class="text-muted ml-auto hidden items-center gap-4 text-xs md:flex"
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
      <div v-if="state.open && state.options.length > 0" class="md:hidden">
        <div
          class="border-default bg-default/95 fixed inset-x-4 bottom-4 z-40 rounded-2xl border p-3 shadow-lg backdrop-blur"
        >
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="(option, index) in state.options"
              :key="option.id"
              type="button"
              class="focus-visible:outline-primary flex size-[3.5rem] items-center justify-center rounded-xl text-base font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              :style="getMobileOptionButtonStyle(getOptionDisplayColor(option.color, index))"
              :aria-label="t('localVote.incrementOption', { option: option.label })"
              :aria-keyshortcuts="option.shortcut ?? undefined"
              :title="option.label"
              @click="incrementOption(option.id)"
            >
              <span aria-hidden="true">{{ option.shortcut ?? '?' }}</span>
            </button>

            <div class="flex gap-2">
              <button
                type="button"
                class="bg-inverted text-inverted focus-visible:outline-primary flex size-[3.5rem] items-center justify-center rounded-xl shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canUndo"
                :aria-label="t('localVote.undoLastVote')"
                :title="t('localVote.undoLastVote')"
                @click="triggerUndo"
              >
                <UIcon name="i-tabler-arrow-back-up" class="size-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                class="bg-inverted text-inverted focus-visible:outline-primary flex size-[3.5rem] items-center justify-center rounded-xl shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
