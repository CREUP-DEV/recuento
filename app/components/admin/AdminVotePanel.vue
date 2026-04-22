<script setup lang="ts">
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

// ─── Optimistic counts ────────────────────────────────────────────────────────
// Stores count overrides applied before the server confirms, keyed by option ID.
// Cleared on structural changes (add/delete/reorder) via emit('refresh').

const localCounts = ref<Record<string, number>>({})

const displayOptions = computed<VoteOption[]>(() =>
  props.vote.options.map((o) => ({
    ...o,
    count: localCounts.value[o.id] ?? o.count,
  }))
)

// Keep local counts in sync when options are added/removed externally
watch(
  () => props.vote.options.map((o) => o.id).join(','),
  () => {
    const validIds = new Set(props.vote.options.map((o) => o.id))
    localCounts.value = Object.fromEntries(
      Object.entries(localCounts.value).filter(([id]) => validIds.has(id))
    )
  }
)

// When the parent refresh brings in new server counts, discard our local overrides
watch(
  () => props.vote.options,
  () => {
    localCounts.value = {}
  },
  { deep: false }
)

const { flashingOptionId } = useVoteKeyboard(
  computed(() => displayOptions.value),
  (optionId) => incrementOption(optionId),
  computed(() => props.vote.open),
  (optionId) => decrementOption(optionId)
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

async function incrementOption(optionId: string) {
  const current = displayOptions.value.find((o) => o.id === optionId)
  if (current) localCounts.value[optionId] = (localCounts.value[optionId] ?? current.count) + 1

  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/increment`,
      { method: 'POST' }
    )
  } catch {
    // Revert optimistic update
    const original = props.vote.options.find((o) => o.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function decrementOption(optionId: string) {
  const current = displayOptions.value.find((o) => o.id === optionId)
  if (current) {
    localCounts.value[optionId] = Math.max(0, (localCounts.value[optionId] ?? current.count) - 1)
  }

  try {
    await $fetch(
      `/api/admin/events/${props.eventId}/votes/${props.vote.id}/options/${optionId}/decrement`,
      { method: 'POST' }
    )
  } catch {
    const original = props.vote.options.find((o) => o.id === optionId)
    if (original) localCounts.value[optionId] = original.count
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function setOptionCount(optionId: string, count: number) {
  localCounts.value[optionId] = count
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
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.reorderError'), color: 'error' })
  }
}

const newOptionLabel = ref('')

async function addOption() {
  if (!newOptionLabel.value.trim()) return
  try {
    await $fetch(`/api/admin/events/${props.eventId}/votes/${props.vote.id}/options`, {
      method: 'POST',
      body: { label: newOptionLabel.value },
    })
    newOptionLabel.value = ''
    emit('refresh')
  } catch {
    toast.add({ title: t('admin.toasts.optionDeleteError'), color: 'error' })
  }
}

const activeShortcuts = computed(() =>
  props.vote.options
    .map((option) => option.shortcut)
    .filter((shortcut): shortcut is string => Boolean(shortcut))
)
</script>

<template>
  <div class="border-default bg-default rounded-xl border shadow-sm">
    <!-- Header -->
    <div class="border-default flex items-center justify-between gap-3 border-b px-6 py-4">
      <div class="flex items-center gap-3">
        <h3 class="font-semibold">{{ vote.name }}</h3>
        <VoteStatus :open="vote.open" :started-at="vote.startedAt" :ended-at="vote.endedAt" />
      </div>
      <div class="flex items-center gap-2">
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
        :is-first="index === 0"
        :is-last="index === displayOptions.length - 1"
        :locked="vote.open"
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
        class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
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
      </div>

      <!-- Add option -->
      <div class="flex items-center gap-2 pt-2">
        <UInput
          v-model="newOptionLabel"
          :placeholder="t('admin.optionPlaceholder')"
          size="sm"
          class="flex-1"
          :disabled="vote.open"
          @keydown.enter.prevent="addOption"
        />
        <UButton
          icon="i-tabler-plus"
          variant="subtle"
          size="sm"
          :disabled="vote.open || !newOptionLabel.trim()"
          @click="addOption"
        >
          {{ t('admin.addOption') }}
        </UButton>
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
