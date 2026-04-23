<script setup lang="ts">
import { SUGGESTED_OPTION_LABEL_KEYS, getVoteShortcut } from '~~/shared/constants/voteOptions'
import {
  buildVoteResultsText,
  getMobileOptionButtonStyle,
  getOptionSuggestionLabels,
  getOptionDisplayColor,
} from '~~/shared/utils/votePresentation'

interface VoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
}

interface Vote {
  id: string
  name: string
  open: boolean
  visible: boolean
  startedAt: string | null
  endedAt: string | null
  options: VoteOption[]
}

const props = defineProps<{
  vote: Vote
  eventId: string
}>()

const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboard()

// ─── Optimistic counts ────────────────────────────────────────────────────────
// Stores count overrides applied before the server confirms, keyed by option ID.
// Cleared on structural changes (add/delete/reorder) via emit('refresh').

const localCounts = ref<Record<string, number>>({})
const voteHistory = ref<string[]>([])
const redoHistory = ref<string[]>([])

const displayOptions = computed<VoteOption[]>(() =>
  props.vote.options.map((o, index) => ({
    ...o,
    shortcut: getVoteShortcut(index),
    count: localCounts.value[o.id] ?? o.count,
  }))
)
const totalVotes = computed(() =>
  displayOptions.value.reduce((sum, option) => sum + option.count, 0)
)
const canUndo = computed(() => voteHistory.value.length > 0)
const canRedo = computed(() => redoHistory.value.length > 0)

// Keep local counts in sync when options are added/removed externally
watch(
  () => props.vote.options.map((o) => o.id).join(','),
  () => {
    const validIds = new Set(props.vote.options.map((o) => o.id))
    localCounts.value = Object.fromEntries(
      Object.entries(localCounts.value).filter(([id]) => validIds.has(id))
    )
    voteHistory.value = voteHistory.value.filter((id) => validIds.has(id))
    redoHistory.value = redoHistory.value.filter((id) => validIds.has(id))
  }
)

// When the parent refresh brings in new server counts, discard our local overrides
watch(
  () => props.vote.options,
  () => {
    localCounts.value = {}
    voteHistory.value = []
    redoHistory.value = []
  },
  { deep: false }
)

const { flashingOptionId, flashOption } = useVoteKeyboard(
  computed(() => displayOptions.value),
  (optionId) => incrementOption(optionId),
  computed(() => props.vote.open),
  () => undoLastVote(),
  () => redoLastVote()
)

// ─── Vote actions ─────────────────────────────────────────────────────────────

const showDeleteVoteModal = ref(false)

async function toggleOpen() {
  const action = props.vote.open ? 'close' : 'open'
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/${action}`, {
      method: 'POST',
    })
    toast.add({
      title: props.vote.open ? t('admin.toasts.voteClosed') : t('admin.toasts.voteOpened'),
      color: 'success',
    })
    localCounts.value = {}
    voteHistory.value = []
    redoHistory.value = []
    emit('refresh')
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } }).data?.message
    toast.add({ title: msg ?? t('admin.toasts.voteDeleteError'), color: 'error' })
  }
}

async function toggleVisibility() {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}`, {
      method: 'PATCH',
      body: { visible: !props.vote.visible },
    })
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.voteVisibilityError'), color: 'error' })
  }
}

async function deleteVote() {
  showDeleteVoteModal.value = false
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}`, { method: 'DELETE' })
    toast.add({ title: t('admin.toasts.voteDeleted'), color: 'success' })
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.voteDeleteError'), color: 'error' })
  }
}

// ─── Option actions ───────────────────────────────────────────────────────────

const pendingDeleteOptionId = ref<string | null>(null)

function removeLastHistoryEntry(optionId: string) {
  const index = voteHistory.value.lastIndexOf(optionId)

  if (index === -1) {
    return -1
  }

  voteHistory.value.splice(index, 1)

  return index
}

function restoreHistoryEntry(optionId: string, index: number) {
  if (index === -1) {
    return
  }

  voteHistory.value.splice(index, 0, optionId)
}

async function incrementOption(optionId: string) {
  if (!props.vote.open) {
    return
  }

  const current = displayOptions.value.find((o) => o.id === optionId)
  if (current) {
    localCounts.value[optionId] = (localCounts.value[optionId] ?? current.count) + 1
    voteHistory.value.push(optionId)
    redoHistory.value = []
  }

  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/increment`,
      { method: 'POST' }
    )
  } catch {
    // Revert optimistic update
    const original = props.vote.options.find((o) => o.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    removeLastHistoryEntry(optionId)
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function decrementOption(optionId: string) {
  if (!props.vote.open) {
    return
  }

  const current = displayOptions.value.find((o) => o.id === optionId)
  if (!current || current.count <= 0) {
    return
  }

  const removedHistoryIndex = removeLastHistoryEntry(optionId)
  localCounts.value[optionId] = Math.max(0, (localCounts.value[optionId] ?? current.count) - 1)
  redoHistory.value = []

  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/decrement`,
      { method: 'POST' }
    )
  } catch {
    const original = props.vote.options.find((o) => o.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    restoreHistoryEntry(optionId, removedHistoryIndex)
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

function undoLastVote() {
  if (!props.vote.open) {
    return null
  }

  const optionId = voteHistory.value.at(-1)

  if (!optionId) {
    return null
  }

  const current = displayOptions.value.find((option) => option.id === optionId)

  if (!current || current.count <= 0) {
    voteHistory.value.pop()
    return null
  }

  voteHistory.value.pop()
  localCounts.value[optionId] = Math.max(0, (localCounts.value[optionId] ?? current.count) - 1)
  redoHistory.value.push(optionId)

  void $fetch(
    `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/decrement`,
    { method: 'POST' }
  ).catch(() => {
    const original = props.vote.options.find((option) => option.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    redoHistory.value.pop()
    voteHistory.value.push(optionId)
    toast.add({ title: t('common.error'), color: 'error' })
  })

  return optionId
}

function triggerUndo() {
  const optionId = undoLastVote()

  if (optionId) {
    flashOption(optionId)
  }
}

function redoLastVote() {
  if (!props.vote.open) {
    return null
  }

  const optionId = redoHistory.value.at(-1)

  if (!optionId) {
    return null
  }

  const current = displayOptions.value.find((option) => option.id === optionId)

  if (!current) {
    redoHistory.value.pop()
    return null
  }

  redoHistory.value.pop()
  localCounts.value[optionId] = (localCounts.value[optionId] ?? current.count) + 1
  voteHistory.value.push(optionId)

  void $fetch(
    `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/increment`,
    { method: 'POST' }
  ).catch(() => {
    const original = props.vote.options.find((option) => option.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    voteHistory.value.pop()
    redoHistory.value.push(optionId)
    toast.add({ title: t('common.error'), color: 'error' })
  })

  return optionId
}

function triggerRedo() {
  const optionId = redoLastVote()

  if (optionId) {
    flashOption(optionId)
  }
}

async function copyResults() {
  try {
    await copy(
      buildVoteResultsText(
        props.vote.name,
        t('admin.totalEmitted'),
        totalVotes.value,
        displayOptions.value
      )
    )
    toast.add({ title: t('admin.copySuccess'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.copyError'), color: 'error' })
  }
}

async function setOptionCount(optionId: string, count: number) {
  if (!props.vote.open) {
    return
  }

  localCounts.value[optionId] = count
  voteHistory.value = []
  redoHistory.value = []
  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/set-count`,
      { method: 'POST', body: { count } }
    )
  } catch {
    const original = props.vote.options.find((o) => o.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function updateOptionColor(optionId: string, color: string | null) {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}`, {
      method: 'PATCH',
      body: { color },
    })
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.colorError'), color: 'error' })
  }
}

async function executeDeleteOption() {
  if (!pendingDeleteOptionId.value) return
  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${pendingDeleteOptionId.value}`,
      { method: 'DELETE' }
    )
    voteHistory.value = []
    redoHistory.value = []
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.optionDeleteError'), color: 'error' })
  } finally {
    pendingDeleteOptionId.value = null
  }
}

async function moveOption(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= props.vote.options.length) {
    return
  }

  const reordered = [...props.vote.options]
  const [moved] = reordered.splice(fromIndex, 1)
  if (!moved) {
    return
  }
  reordered.splice(toIndex, 0, moved)
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/reorder`, {
      method: 'POST',
      body: { orderedIds: reordered.map((o) => o.id) },
    })
    voteHistory.value = []
    redoHistory.value = []
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.reorderError'), color: 'error' })
  }
}

const newOptionLabel = ref('')
const suggestedOptionLabels = computed(() =>
  getOptionSuggestionLabels(t, SUGGESTED_OPTION_LABEL_KEYS[props.vote.options.length])
)

async function addOptionWithLabel(label: string) {
  const trimmedLabel = label.trim()

  if (!trimmedLabel) return

  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options`, {
      method: 'POST',
      body: { label: trimmedLabel },
    })
    newOptionLabel.value = ''
    voteHistory.value = []
    redoHistory.value = []
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.optionDeleteError'), color: 'error' })
  }
}

async function submitAddOption() {
  await addOptionWithLabel(newOptionLabel.value)
}

const activeShortcuts = computed(() =>
  displayOptions.value
    .map((option) => option.shortcut)
    .filter((shortcut): shortcut is string => Boolean(shortcut))
)
</script>

<template>
  <div
    class="border-default bg-default rounded-xl border shadow-sm"
    :class="vote.open && displayOptions.length > 0 ? 'pb-24 md:pb-0' : ''"
  >
    <!-- Header -->
    <div class="border-default flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-3">
          <h3 class="font-semibold">{{ vote.name }}</h3>
          <VoteStatus :open="vote.open" :started-at="vote.startedAt" :ended-at="vote.endedAt" />
          <span class="text-muted text-sm">
            {{ t('admin.totalEmitted') }}:
            <span class="font-mono font-semibold">{{ totalVotes }}</span>
          </span>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          icon="i-tabler-arrow-back-up"
          variant="subtle"
          color="neutral"
          size="xs"
          class="hidden md:inline-flex"
          :disabled="!canUndo || !vote.open"
          aria-keyshortcuts="Backspace"
          @click="triggerUndo"
        >
          {{ t('admin.undoLastVoteButton') }}
        </UButton>
        <UButton
          icon="i-tabler-arrow-forward-up"
          variant="subtle"
          color="neutral"
          size="xs"
          class="hidden md:inline-flex"
          :disabled="!canRedo || !vote.open"
          aria-keyshortcuts="Shift+Backspace"
          @click="triggerRedo"
        >
          {{ t('admin.redoLastVoteButton') }}
        </UButton>
        <UButton
          icon="i-tabler-copy"
          variant="subtle"
          color="neutral"
          size="xs"
          :disabled="displayOptions.length === 0"
          @click="copyResults"
        >
          {{ t('admin.copyResults') }}
        </UButton>
        <UButton
          :color="vote.visible ? 'success' : 'neutral'"
          variant="subtle"
          size="xs"
          :aria-pressed="vote.visible"
          :disabled="vote.open && vote.visible"
          @click="toggleVisibility"
        >
          {{ vote.visible ? t('admin.visible') : t('admin.hidden') }}
        </UButton>
        <UButton
          v-if="!vote.open"
          icon="i-tabler-player-play"
          variant="subtle"
          color="success"
          size="sm"
          :aria-label="t('admin.openVote')"
          @click="toggleOpen"
        />
        <UButton
          v-else
          icon="i-tabler-player-stop"
          variant="subtle"
          color="error"
          size="sm"
          :aria-label="t('admin.closeVote')"
          @click="toggleOpen"
        />
        <UButton
          icon="i-tabler-trash"
          variant="ghost"
          color="error"
          size="sm"
          :aria-label="t('admin.deleteVote')"
          @click="showDeleteVoteModal = true"
        />
      </div>
    </div>

    <!-- Options -->
    <div class="space-y-3 p-6">
      <AdminVoteOptionRow
        v-for="(option, index) in displayOptions"
        :key="option.id"
        :option="option"
        :flashing="flashingOptionId === option.id"
        :index="index"
        :total="totalVotes"
        :is-first="index === 0"
        :is-last="index === displayOptions.length - 1"
        :locked="vote.open"
        :active="vote.open"
        @increment="incrementOption(option.id)"
        @decrement="decrementOption(option.id)"
        @delete="pendingDeleteOptionId = option.id"
        @set-count="(count) => setOptionCount(option.id, count)"
        @update-color="(color) => updateOptionColor(option.id, color)"
        @move-up="moveOption(index, index - 1)"
        @move-down="moveOption(index, index + 1)"
      />

      <div
        v-if="vote.open && activeShortcuts.length > 0"
        class="text-muted-foreground hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs md:flex"
      >
        <span class="flex items-center gap-1.5">
          <UIcon name="i-tabler-keyboard" class="size-3.5" />
          {{ t('admin.keyboardShortcutsActive') }}
          <span v-for="s in activeShortcuts" :key="s">
            <kbd class="bg-muted rounded px-1 py-0.5 font-mono">{{ s }}</kbd>
          </span>
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="bg-muted rounded px-1.5 py-0.5 font-mono">⌫</kbd>
          {{ t('admin.undoLastVote') }}
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="bg-muted rounded px-1 py-0.5 font-mono">⇧</kbd>
          <kbd class="bg-muted rounded px-1.5 py-0.5 font-mono">⌫</kbd>
          {{ t('admin.redoLastVote') }}
        </span>
      </div>

      <Teleport to="body">
        <div v-if="vote.open && displayOptions.length > 0" class="md:hidden">
          <div
            class="border-default bg-default/95 fixed inset-x-4 bottom-4 z-40 rounded-2xl border p-3 shadow-lg backdrop-blur"
          >
            <div class="flex flex-wrap justify-center gap-2">
              <button
                v-for="(option, index) in displayOptions"
                :key="option.id"
                type="button"
                class="focus-visible:outline-primary flex size-[3.5rem] items-center justify-center rounded-xl text-base font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                :style="getMobileOptionButtonStyle(getOptionDisplayColor(option.color, index))"
                :aria-label="t('admin.incrementOption', { option: option.label })"
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
                  :aria-label="t('admin.undoLastVoteButton')"
                  :title="t('admin.undoLastVoteButton')"
                  @click="triggerUndo"
                >
                  <UIcon name="i-tabler-arrow-back-up" class="size-5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="bg-inverted text-inverted focus-visible:outline-primary flex size-[3.5rem] items-center justify-center rounded-xl shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canRedo"
                  :aria-label="t('admin.redoLastVoteButton')"
                  :title="t('admin.redoLastVoteButton')"
                  @click="triggerRedo"
                >
                  <UIcon name="i-tabler-arrow-forward-up" class="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Add option -->
      <div v-if="!vote.open" class="pt-2">
        <div class="flex items-center gap-2">
          <UInput
            v-model="newOptionLabel"
            :placeholder="t('admin.optionPlaceholder')"
            size="sm"
            class="flex-1"
            :disabled="vote.open"
            @keydown.enter.prevent="submitAddOption"
          />
          <UButton
            icon="i-tabler-plus"
            variant="subtle"
            size="sm"
            :disabled="vote.open || !newOptionLabel.trim()"
            @click="submitAddOption"
          >
            {{ t('admin.addOption') }}
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
              :disabled="vote.open"
              @click="
                () => {
                  void addOptionWithLabel(label)
                }
              "
            >
              {{ label }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete vote confirmation -->
  <UModal v-model:open="showDeleteVoteModal">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold">{{ t('admin.deleteVote') }}</h3>
        <p class="text-muted mt-2">
          {{ t('admin.deleteVoteConfirmMessage', { name: vote.name }) }}
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <UButton variant="ghost" color="neutral" @click="showDeleteVoteModal = false">
            {{ t('admin.cancel') }}
          </UButton>
          <UButton color="error" @click="deleteVote">{{ t('admin.delete') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Delete option confirmation -->
  <UModal :open="pendingDeleteOptionId !== null" @update:open="pendingDeleteOptionId = null">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold">{{ t('admin.deleteOption') }}</h3>
        <p class="text-muted mt-2">{{ t('admin.deleteOptionMessage') }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <UButton variant="ghost" color="neutral" @click="pendingDeleteOptionId = null">
            {{ t('admin.cancel') }}
          </UButton>
          <UButton color="error" @click="executeDeleteOption">{{ t('admin.delete') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
