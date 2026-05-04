<script setup lang="ts">
import draggable from 'vuedraggable'
import {
  DEFAULT_OPTION_COLORS,
  SUGGESTED_OPTION_LABEL_KEYS,
  getVoteShortcut,
} from '~~/shared/constants/voteOptions'
import {
  buildVoteResultsText,
  getMobileOptionButtonStyle,
  getOptionSuggestionLabels,
  getOptionDisplayColor,
} from '~~/shared/utils/votePresentation'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'

interface VoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
  canWin: boolean
}

interface Vote {
  id: string
  slug: string
  name: string
  open: boolean
  visible: boolean
  startedAt: string | null
  endedAt: string | null
  minimumVotes: number | null
  maxWinners: number | null
  confettiEnabled: boolean
  options: VoteOption[]
}

const props = defineProps<{
  vote: Vote
  eventId: string
  expanded: boolean
}>()

const emit = defineEmits<{
  refresh: [focusVoteId?: string]
  toggle: []
  'update-vote': [fields: Partial<Vote>]
  'update-option': [optionId: string, fields: Partial<VoteOption>]
}>()

const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const { copy } = useClipboard()
const { launchConfetti } = useConfetti()

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

const winnerIds = computed(() => {
  if (props.vote.open) return new Set<string>()
  return calculateWinners(
    props.vote.options.map((o) => ({ id: o.id, count: o.count, canWin: o.canWin })),
    props.vote.minimumVotes,
    props.vote.maxWinners
  ).winnerIds
})

function getThresholdReached(option: VoteOption) {
  return (
    props.vote.minimumVotes !== null &&
    option.canWin &&
    (localCounts.value[option.id] ?? option.count) >= props.vote.minimumVotes
  )
}
const totalVotes = computed(() =>
  displayOptions.value.reduce((sum, option) => sum + option.count, 0)
)
type AdminVotePhase = 'setup' | 'voting' | 'results'
const votePhase = computed((): AdminVotePhase => {
  if (props.vote.open) return 'voting'
  if (totalVotes.value > 0) return 'results'
  return 'setup'
})
const openActionLabel = computed(() =>
  votePhase.value === 'results' ? t('admin.reopenVote') : t('admin.openVote')
)
const canUndo = computed(() => voteHistory.value.length > 0)
const canRedo = computed(() => redoHistory.value.length > 0)
const sortableOptions = ref<VoteOption[]>([])
const isReorderingOptions = ref(false)
const dragStartOptions = ref<VoteOption[]>([])
const { listContainerRef: closedOptionsContainerRef, animateLayoutChange } = useListFlipAnimation()

function withReassignedShortcuts(options: VoteOption[]) {
  return options.map((option, index) => ({
    ...option,
    shortcut: getVoteShortcut(index),
  }))
}

function collectColorOverrides(options: VoteOption[]) {
  const overrides: Record<string, string> = {}
  options.forEach((option, i) => {
    if (option.color === null) {
      overrides[option.id] = DEFAULT_OPTION_COLORS[i % DEFAULT_OPTION_COLORS.length] ?? '#93c5fd'
    }
  })
  return overrides
}

watch(
  () => props.vote.options,
  (options) => {
    if (isReorderingOptions.value) {
      return
    }

    sortableOptions.value = withReassignedShortcuts(options)
  },
  { immediate: true }
)

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

// Clear local overrides when the vote transitions from open to closed
watch(
  () => props.vote.open,
  (open) => {
    if (!open) {
      localCounts.value = {}
      voteHistory.value = []
      redoHistory.value = []
    }
  }
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
const showSettingsModal = ref(false)
const isTogglingOpen = ref(false)

async function toggleOpen() {
  if (isTogglingOpen.value) return
  const action = props.vote.open ? 'close' : 'open'
  isTogglingOpen.value = true
  try {
    const res = await $fetch<{ data: { winnerIds?: string[] } }>(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/${action}`,
      { method: 'POST' }
    )
    toast.add({
      title: props.vote.open ? t('admin.toasts.voteClosed') : t('admin.toasts.voteOpened'),
      color: 'success',
    })
    umTrackEvent(action === 'open' ? 'vote_opened' : 'vote_closed', { voteId: props.vote.id })
    if (action === 'close' && props.vote.confettiEnabled && res.data.winnerIds?.length) {
      launchConfetti()
    }
    localCounts.value = {}
    voteHistory.value = []
    redoHistory.value = []
    emit('refresh', action === 'open' ? props.vote.id : undefined)
  } catch (err: unknown) {
    const apiErr = err as {
      data?: { openVoteId?: string; openEventId?: string; openVoteName?: string }
    }
    const openEventId = apiErr.data?.openEventId
    const openVoteName = apiErr.data?.openVoteName
    if (openEventId) {
      toast.add({
        title: t('admin.toasts.openVoteBlocked'),
        description: t('admin.toasts.openVoteConflict', { name: openVoteName }),
        color: 'warning',
        actions: [
          {
            label: t('admin.toasts.goToVote'),
            onClick: async () => {
              await navigateTo(localePath(`/admin/events/${openEventId}`))
            },
          },
        ],
      })
    } else {
      toast.add({ title: t('common.error'), color: 'error' })
    }
    umTrackEvent('vote_open_conflict', { voteId: props.vote.id })
  } finally {
    isTogglingOpen.value = false
  }
}

async function toggleVisibility() {
  const newVisible = !props.vote.visible
  emit('update-vote', { visible: newVisible })
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}`, {
      method: 'PATCH',
      body: { visible: newVisible },
    })
  } catch {
    emit('update-vote', { visible: !newVisible })
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
      { method: 'POST', headers: { 'x-request-id': crypto.randomUUID() } }
    )
  } catch {
    removeLastHistoryEntry(optionId)
    localCounts.value = {}
    emit('refresh')
    toast.add({ title: t('common.error'), color: 'error' })
    umTrackEvent('vote_increment_failed', { voteId: props.vote.id, optionId })
  }
}

function incrementAndFlash(optionId: string) {
  void incrementOption(optionId)
  flashOption(optionId)
}

async function decrementOption(optionId: string) {
  if (!props.vote.open) {
    return
  }

  const current = displayOptions.value.find((o) => o.id === optionId)
  if (!current || current.count <= 0) {
    return
  }

  localCounts.value[optionId] = Math.max(0, (localCounts.value[optionId] ?? current.count) - 1)
  redoHistory.value = []

  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/decrement`,
      { method: 'POST', headers: { 'x-request-id': crypto.randomUUID() } }
    )
  } catch {
    localCounts.value = {}
    emit('refresh')
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

function decrementAndFlash(optionId: string) {
  const option = displayOptions.value.find((entry) => entry.id === optionId)
  if (!option || option.count <= 0) return
  void decrementOption(optionId)
  flashOption(optionId)
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
    { method: 'POST', headers: { 'x-request-id': crypto.randomUUID() } }
  ).catch(() => {
    localCounts.value = {}
    emit('refresh')
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
    { method: 'POST', headers: { 'x-request-id': crypto.randomUUID() } }
  ).catch(() => {
    localCounts.value = {}
    emit('refresh')
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
  toast.add({ title: t('admin.toasts.historyCleared'), color: 'neutral', duration: 2000 })
  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/set-count`,
      { method: 'POST', body: { count } }
    )
  } catch {
    localCounts.value = {}
    emit('refresh')
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function updateOptionColor(optionId: string, color: string | null) {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}`, {
      method: 'PATCH',
      body: { color },
    })
    sortableOptions.value = sortableOptions.value.map((option) =>
      option.id === optionId ? { ...option, color } : option
    )
    emit('update-option', optionId, { color })
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

async function persistOptionOrder(orderedIds: string[], colorOverrides?: Record<string, string>) {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/reorder`, {
      method: 'POST',
      body: {
        orderedIds,
        ...(colorOverrides && Object.keys(colorOverrides).length > 0 ? { colorOverrides } : {}),
      },
    })
    voteHistory.value = []
    redoHistory.value = []
    emit('update-vote', {
      options: sortableOptions.value.map((option) => ({ ...option })),
    })
    return true
  } catch {
    return false
  }
}

async function moveOption(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= sortableOptions.value.length || isReorderingOptions.value) {
    return
  }

  const previousOptions = sortableOptions.value.map((option) => ({ ...option }))
  const colorOverrides = collectColorOverrides(sortableOptions.value)

  const reordered = sortableOptions.value.map((option) => ({
    ...option,
    color: colorOverrides[option.id] ?? option.color,
  }))
  const [moved] = reordered.splice(fromIndex, 1)
  if (!moved) {
    return
  }

  reordered.splice(toIndex, 0, moved)
  const normalizedOptions = withReassignedShortcuts(reordered)

  await animateLayoutChange(() => {
    sortableOptions.value = normalizedOptions
  })

  isReorderingOptions.value = true

  const persisted = await persistOptionOrder(
    normalizedOptions.map((option) => option.id),
    colorOverrides
  )

  if (!persisted) {
    await animateLayoutChange(() => {
      sortableOptions.value = previousOptions
    })
    toast.add({ title: t('admin.toasts.reorderError'), color: 'error' })
  }

  isReorderingOptions.value = false
}

function onDragStart() {
  dragStartOptions.value = sortableOptions.value.map((option) => ({ ...option }))
}

async function onDragChange(event: { moved?: { oldIndex: number; newIndex: number } }) {
  if (!event.moved) {
    return
  }

  const previousOptions = dragStartOptions.value.map((option) => ({ ...option }))
  const colorOverrides = collectColorOverrides(sortableOptions.value)

  isReorderingOptions.value = true
  sortableOptions.value.forEach((option, i) => {
    if (colorOverrides[option.id]) option.color = colorOverrides[option.id]!
    option.shortcut = getVoteShortcut(i)
  })

  const persisted = await persistOptionOrder(
    sortableOptions.value.map((option) => option.id),
    colorOverrides
  )

  if (!persisted) {
    sortableOptions.value = previousOptions
    toast.add({ title: t('admin.toasts.reorderError'), color: 'error' })
  }

  isReorderingOptions.value = false
}

// ─── Vote settings ────────────────────────────────────────────────────────────

const settingsOpen = ref(true)

watch(
  () => props.vote.open,
  (open) => {
    if (open) settingsOpen.value = false
  }
)

const settingsMinimumVotes = ref<string>(
  props.vote.minimumVotes !== null ? String(props.vote.minimumVotes) : ''
)
const settingsMaxWinners = ref<string>(
  props.vote.maxWinners !== null ? String(props.vote.maxWinners) : ''
)
const settingsSlug = ref(props.vote.slug)
const confettiToggle = ref(props.vote.confettiEnabled)

watch(
  () => props.vote.minimumVotes,
  (val) => {
    settingsMinimumVotes.value = val !== null ? String(val) : ''
  }
)
watch(
  () => props.vote.maxWinners,
  (val) => {
    settingsMaxWinners.value = val !== null ? String(val) : ''
  }
)
watch(
  () => props.vote.confettiEnabled,
  (val) => {
    confettiToggle.value = val
  }
)
watch(
  () => props.vote.slug,
  (val) => {
    settingsSlug.value = val
  }
)

async function updateConfettiSetting(value: boolean) {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}`, {
      method: 'PATCH',
      body: { confettiEnabled: value },
    })
    emit('update-vote', { confettiEnabled: value })
  } catch {
    confettiToggle.value = !value
    toast.add({ title: t('admin.toasts.voteSettingsError'), color: 'error' })
  }
}

async function updateVoteSettings(field: 'minimumVotes' | 'maxWinners', rawValue: string | number) {
  const str = String(rawValue)
  const parsed = str.trim() === '' ? null : parseInt(str, 10)
  if (parsed !== null && (Number.isNaN(parsed) || parsed < 1)) return
  const currentVal = field === 'minimumVotes' ? props.vote.minimumVotes : props.vote.maxWinners
  if (parsed === currentVal) return
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}`, {
      method: 'PATCH',
      body: { [field]: parsed },
    })
    emit('update-vote', { [field]: parsed })
    toast.add({ title: t('admin.toasts.voteSettingsUpdated'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.toasts.voteSettingsError'), color: 'error' })
  }
}

async function updateVoteSlug() {
  const slug = settingsSlug.value.trim()
  if (!slug || slug === props.vote.slug) return

  try {
    const response = await $fetch<{ data: Vote }>(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}`,
      {
        method: 'PATCH',
        body: { slug },
      }
    )
    emit('update-vote', { slug: response.data.slug })
    settingsSlug.value = response.data.slug
    toast.add({ title: t('admin.toasts.voteSettingsUpdated'), color: 'success' })
  } catch {
    settingsSlug.value = props.vote.slug
    toast.add({ title: t('admin.toasts.voteSettingsError'), color: 'error' })
  }
}

async function updateOptionCanWin(optionId: string, canWin: boolean) {
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}`, {
      method: 'PATCH',
      body: { canWin },
    })
    emit('update-option', optionId, { canWin })
    const opt = sortableOptions.value.find((o) => o.id === optionId)
    if (opt) opt.canWin = canWin
  } catch {
    toast.add({ title: t('admin.toasts.canWinError'), color: 'error' })
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
    toast.add({ title: t('admin.toasts.optionAddError'), color: 'error' })
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

const floatingBarRef = ref<HTMLElement | null>(null)
const { height: floatingBarHeight } = useElementSize(floatingBarRef)
const isDesktop = useMediaQuery('(min-width: 768px)')
const mobileBottomPadding = computed(() =>
  !isDesktop.value && props.vote.open && displayOptions.value.length > 0
    ? `${floatingBarHeight.value + 16}px`
    : undefined
)

// Warn before unloading while a vote is active so admins don't accidentally lose context
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (props.vote.open) {
    e.preventDefault()
  }
})
</script>

<template>
  <div
    :id="`admin-vote-card-${vote.id}`"
    class="border-default bg-default relative overflow-hidden rounded-xl border transition-[background-color,border-color,box-shadow,padding] duration-200 md:pb-0"
    :class="vote.open ? 'border-primary/20 shadow-sm' : 'shadow-sm'"
    :style="mobileBottomPadding ? { paddingBottom: mobileBottomPadding } : {}"
  >
    <!-- Header -->
    <div
      class="border-default relative z-10 flex flex-col gap-3 border-b px-4 py-3 transition-colors duration-200 sm:px-5"
      :class="vote.open ? 'bg-muted/20' : 'bg-transparent'"
    >
      <!-- Row 1: name + primary action -->
      <div class="flex min-w-0 items-start gap-3">
        <button
          type="button"
          class="focus-visible:ring-primary/60 flex min-w-0 flex-1 items-start gap-2 rounded-sm pt-1 text-left focus-visible:ring-2 focus-visible:outline-none"
          :aria-expanded="expanded"
          :aria-controls="`admin-vote-panel-${vote.id}`"
          @click="emit('toggle')"
        >
          <UIcon
            name="i-tabler-chevron-right"
            class="text-muted size-4 shrink-0 transition-transform duration-200"
            :class="expanded ? 'rotate-90' : ''"
            aria-hidden="true"
          />
          <span class="wrap-break-words min-w-0 leading-snug font-semibold">{{ vote.name }}</span>
        </button>
        <UButton
          v-if="!vote.open"
          icon="i-tabler-player-play"
          variant="subtle"
          color="success"
          size="sm"
          class="shrink-0 transition-transform duration-200 active:scale-95"
          :loading="isTogglingOpen"
          :aria-label="openActionLabel"
          @click="toggleOpen"
        >
          {{ openActionLabel }}
        </UButton>
        <UButton
          v-else
          icon="i-tabler-player-stop"
          variant="subtle"
          color="error"
          size="sm"
          class="shrink-0 transition-transform duration-200 active:scale-95"
          :loading="isTogglingOpen"
          :aria-label="t('admin.closeVote')"
          @click="toggleOpen"
        >
          {{ t('admin.closeVote') }}
        </UButton>
      </div>
      <!-- Row 2: status + secondary actions -->
      <div class="flex flex-wrap items-center gap-2 pl-6">
        <span v-if="votePhase !== 'setup'" class="text-muted text-sm">
          {{ t('admin.totalEmitted') }}:
          <span class="font-mono font-semibold">{{ totalVotes }}</span>
        </span>
        <div class="ml-auto flex flex-wrap items-center justify-end gap-1">
          <UButton
            v-if="votePhase !== 'setup'"
            icon="i-tabler-settings"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('admin.viewVoteSettings')"
            @click="showSettingsModal = true"
          />
          <Transition name="vote-controls">
            <div v-if="vote.open" class="hidden md:inline-flex">
              <UButton
                icon="i-tabler-arrow-back-up"
                variant="subtle"
                color="neutral"
                size="xs"
                :disabled="!canUndo"
                aria-keyshortcuts="Backspace"
                @click="triggerUndo"
              >
                {{ t('admin.undoLastVoteButton') }}
              </UButton>
            </div>
          </Transition>
          <Transition name="vote-controls">
            <div v-if="vote.open" class="hidden md:inline-flex">
              <UButton
                icon="i-tabler-arrow-forward-up"
                variant="subtle"
                color="neutral"
                size="xs"
                :disabled="!canRedo"
                aria-keyshortcuts="Shift+Backspace"
                @click="triggerRedo"
              >
                {{ t('admin.redoLastVoteButton') }}
              </UButton>
            </div>
          </Transition>
          <UButton
            icon="i-tabler-copy"
            variant="subtle"
            color="neutral"
            size="xs"
            :disabled="displayOptions.length === 0 || votePhase === 'setup'"
            @click="copyResults"
          >
            <span class="hidden sm:inline">{{ t('admin.copyResults') }}</span>
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
            icon="i-tabler-trash"
            variant="ghost"
            color="error"
            size="sm"
            :aria-label="t('admin.deleteVote')"
            @click="showDeleteVoteModal = true"
          />
        </div>
      </div>
    </div>

    <!-- Options -->
    <div v-show="expanded" :id="`admin-vote-panel-${vote.id}`" class="relative z-10 space-y-4 p-6">
      <!-- Vote settings (accordion) -->
      <div v-if="votePhase === 'setup'" class="border-default rounded-lg border">
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
            <div class="px-4 pb-4" :class="vote.open ? 'pointer-events-none opacity-60' : ''">
              <div class="mb-4 flex flex-col gap-1">
                <label class="text-muted text-sm font-medium" :for="`setting-slug-${vote.id}`">
                  {{ t('admin.slug') }}
                </label>
                <UInput
                  :id="`setting-slug-${vote.id}`"
                  v-model="settingsSlug"
                  size="sm"
                  class="font-mono"
                  :placeholder="t('admin.slugPlaceholder')"
                  @blur="updateVoteSlug"
                  @keydown.enter.prevent="updateVoteSlug"
                />
              </div>
              <div class="flex flex-wrap gap-4">
                <div class="flex min-w-40 flex-1 flex-col gap-1">
                  <label class="text-muted text-sm font-medium" for="setting-min-votes">
                    {{ t('admin.minimumVotes') }}
                  </label>
                  <UInput
                    id="setting-min-votes"
                    v-model="settingsMinimumVotes"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    size="sm"
                    :placeholder="t('admin.minimumVotesPlaceholder')"
                    @blur="updateVoteSettings('minimumVotes', settingsMinimumVotes)"
                    @keydown.enter.prevent="
                      updateVoteSettings('minimumVotes', settingsMinimumVotes)
                    "
                  />
                  <p class="text-muted text-xs">{{ t('admin.minimumVotesHelp') }}</p>
                </div>
                <div class="flex min-w-40 flex-1 flex-col gap-1">
                  <label class="text-muted text-sm font-medium" for="setting-max-winners">
                    {{ t('admin.maxWinners') }}
                  </label>
                  <UInput
                    id="setting-max-winners"
                    v-model="settingsMaxWinners"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    size="sm"
                    :placeholder="t('admin.maxWinnersPlaceholder')"
                    @blur="updateVoteSettings('maxWinners', settingsMaxWinners)"
                    @keydown.enter.prevent="updateVoteSettings('maxWinners', settingsMaxWinners)"
                  />
                  <p class="text-muted text-xs">{{ t('admin.maxWinnersHelp') }}</p>
                </div>
              </div>
              <p class="text-muted mt-3 text-xs">{{ t('admin.canWinHelp') }}</p>
              <div class="border-default mt-3 flex items-center gap-3 border-t pt-3">
                <USwitch
                  v-model="confettiToggle"
                  :aria-label="t('admin.confettiEnabled')"
                  @update:model-value="updateConfettiSetting"
                />
                <div>
                  <p class="text-sm font-medium">{{ t('admin.confettiEnabled') }}</p>
                  <p class="text-muted text-xs">{{ t('admin.confettiEnabledHelp') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results with winners (post-close) -->
      <div
        v-if="votePhase === 'results' && displayOptions.length > 0 && winnerIds.size > 0"
        class="border-default rounded-lg border p-4"
      >
        <p class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
          {{ t('votes.winners') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="option in displayOptions.filter((o) => winnerIds.has(o.id))"
            :key="option.id"
            class="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          >
            <UIcon name="i-tabler-trophy" class="size-3.5" />
            {{ option.label }}
          </span>
        </div>
      </div>

      <div v-if="vote.open" class="space-y-3">
        <VoteOptionRow
          v-for="(option, index) in displayOptions"
          :key="option.id"
          :option="option"
          :flashing="flashingOptionId === option.id"
          :index="index"
          :total="totalVotes"
          :is-first="index === 0"
          :is-last="index === displayOptions.length - 1"
          :locked="true"
          :active="vote.open"
          :threshold-reached="getThresholdReached(option)"
          @increment="incrementAndFlash(option.id)"
          @decrement="decrementAndFlash(option.id)"
          @delete="pendingDeleteOptionId = option.id"
          @set-count="(count) => setOptionCount(option.id, count)"
          @update-color="(color) => updateOptionColor(option.id, color)"
        />
      </div>

      <div v-else ref="closedOptionsContainerRef" class="space-y-3">
        <p v-if="votePhase === 'setup'" class="text-muted flex items-start gap-2 text-sm">
          <UIcon name="i-tabler-toggle-right" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{{ t('admin.optionSwitchHelp') }}</span>
        </p>
        <draggable
          :list="sortableOptions"
          item-key="id"
          tag="div"
          class="space-y-3"
          handle=".drag-handle"
          :disabled="isReorderingOptions || votePhase === 'results'"
          drag-class="vote-dragging"
          ghost-class="vote-drag-ghost"
          animation="180"
          @start="onDragStart"
          @change="onDragChange"
        >
          <template #item="{ element: option, index }">
            <VoteOptionRow
              :option="option"
              :flashing="flashingOptionId === option.id"
              :index="index"
              :total="totalVotes"
              :is-first="index === 0"
              :is-last="index === sortableOptions.length - 1"
              :locked="isReorderingOptions"
              :active="vote.open"
              :is-winner="winnerIds.has(option.id)"
              :results-mode="votePhase === 'results'"
              :hide-count="votePhase === 'setup'"
              :hide-progress="votePhase === 'setup'"
              hide-can-win-label
              @delete="pendingDeleteOptionId = option.id"
              @update-color="(color) => updateOptionColor(option.id, color)"
              @update-can-win="(canWin) => updateOptionCanWin(option.id, canWin)"
              @move-up="moveOption(index, index - 1)"
              @move-down="moveOption(index, index + 1)"
            />
          </template>
        </draggable>
      </div>

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
        <Transition name="vote-float">
          <div v-if="vote.open && displayOptions.length > 0" class="md:hidden">
            <div
              ref="floatingBarRef"
              class="border-default bg-default/95 fixed inset-x-4 bottom-4 z-40 rounded-2xl border p-3 shadow-lg backdrop-blur"
            >
              <div class="flex flex-wrap justify-center gap-2">
                <button
                  v-for="(option, index) in displayOptions"
                  :key="option.id"
                  type="button"
                  class="focus-visible:outline-primary flex size-14 items-center justify-center rounded-xl text-base font-bold shadow-sm transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
                  :style="getMobileOptionButtonStyle(getOptionDisplayColor(option.color, index))"
                  :aria-label="t('admin.incrementOption', { option: option.label })"
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
                    :aria-label="t('admin.undoLastVoteButton')"
                    :title="t('admin.undoLastVoteButton')"
                    @click="triggerUndo"
                  >
                    <UIcon name="i-tabler-arrow-back-up" class="size-5" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    class="bg-inverted text-inverted focus-visible:outline-primary flex size-14 items-center justify-center rounded-xl shadow-sm transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
        </Transition>
      </Teleport>

      <!-- Add option -->
      <div v-if="votePhase === 'setup'" class="pt-2">
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
        <p class="text-muted mt-2">
          {{
            t('admin.deleteOptionMessage', {
              name: displayOptions.find((o) => o.id === pendingDeleteOptionId)?.label ?? '',
            })
          }}
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <UButton variant="ghost" color="neutral" @click="pendingDeleteOptionId = null">
            {{ t('admin.cancel') }}
          </UButton>
          <UButton color="error" @click="executeDeleteOption">{{ t('admin.delete') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Settings summary -->
  <UModal v-model:open="showSettingsModal">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold">{{ t('admin.voteSettings') }}</h3>
        <dl class="mt-4 space-y-3">
          <div class="flex justify-between gap-4">
            <dt class="text-muted">{{ t('admin.minimumVotes') }}</dt>
            <dd class="font-medium">
              {{ vote.minimumVotes ?? t('admin.minimumVotesPlaceholder') }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted">{{ t('admin.maxWinners') }}</dt>
            <dd class="font-medium">
              {{ vote.maxWinners ?? t('admin.maxWinnersPlaceholder') }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted">{{ t('admin.confettiEnabled') }}</dt>
            <dd class="font-medium">
              {{ vote.confettiEnabled ? t('common.yes') : t('common.no') }}
            </dd>
          </div>
        </dl>
        <div class="mt-6 flex justify-end">
          <UButton color="neutral" variant="subtle" @click="showSettingsModal = false">
            {{ t('admin.close') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
