<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AdminEventVoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
  canWin: boolean
}

interface AdminEventVote {
  id: string
  name: string
  open: boolean
  visible: boolean
  startedAt: string | null
  endedAt: string | null
  minimumVotes: number | null
  maxWinners: number | null
  confettiEnabled: boolean
  options: AdminEventVoteOption[]
}

interface AdminEventData {
  id: string
  name: string
  banner: string | null
  startDate: string
  endDate: string
  votes: AdminEventVote[]
}

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const localePath = useLocalePath()
const eventId = route.params.id as string

const { data: eventData, refresh } = await useFetch<{ data: AdminEventData }>(
  `/api/admin/events/${eventId}`
)
const ev = computed(() => eventData.value?.data)
const expandedVoteIds = ref<Set<string>>(new Set())
const allVotesExpanded = computed(() => {
  const votes = ev.value?.votes ?? []
  return votes.length > 0 && votes.every((vote) => expandedVoteIds.value.has(vote.id))
})

if (!ev.value) {
  throw createError({ statusCode: 404, statusMessage: 'Evento no encontrado' })
}

function toDateInput(ts: string | null | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : ''
}

function syncEditForm(data: Pick<AdminEventData, 'name' | 'startDate' | 'endDate'>) {
  editForm.value.name = data.name
  editForm.value.startDate = toDateInput(data.startDate)
  editForm.value.endDate = toDateInput(data.endDate)
}

// ─── Event editing ────────────────────────────────────────────────────────────

const editForm = ref({
  name: ev.value?.name ?? '',
  startDate: toDateInput(ev.value?.startDate),
  endDate: toDateInput(ev.value?.endDate),
})

watch(ev, (val) => {
  if (val && !isFormDirty.value) {
    syncEditForm(val)
  }
})

const isFormDirty = computed(() => {
  if (!ev.value) return false
  return (
    editForm.value.name !== ev.value.name ||
    editForm.value.startDate !== toDateInput(ev.value.startDate) ||
    editForm.value.endDate !== toDateInput(ev.value.endDate)
  )
})

useEventListener('beforeunload', (e: BeforeUnloadEvent) => {
  if (isFormDirty.value) e.preventDefault()
})

async function updateEvent() {
  try {
    const { data } = await $fetch<{
      data: Pick<AdminEventData, 'id' | 'name' | 'banner' | 'startDate' | 'endDate'>
    }>(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      body: editForm.value,
    })

    if (eventData.value?.data) {
      eventData.value = {
        data: {
          ...eventData.value.data,
          ...data,
        },
      }
    }

    syncEditForm(data)
    toast.add({ title: t('admin.toasts.eventUpdated'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.toasts.eventUpdateError'), color: 'error' })
  }
}

// ─── Banner upload ────────────────────────────────────────────────────────────

const bannerInput = ref<HTMLInputElement | null>(null)
const isUploadingBanner = ref(false)
const bannerPreview = ref<string | null>(null)

function onBannerFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  bannerPreview.value = URL.createObjectURL(file)
  void uploadBanner(e)
}

async function uploadBanner(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploadingBanner.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    await $fetch(`/api/admin/events/${eventId}/banner`, {
      method: 'POST',
      body: formData,
    })
    toast.add({ title: t('admin.toasts.bannerUploaded'), color: 'success' })
    bannerPreview.value = null
    await refresh()
  } catch {
    bannerPreview.value = null
    toast.add({ title: t('admin.toasts.bannerUploadError'), color: 'error' })
  } finally {
    isUploadingBanner.value = false
    if (target) target.value = ''
  }
}

const isRemovingBanner = ref(false)

async function removeBanner() {
  isRemovingBanner.value = true
  try {
    await $fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      body: { banner: null },
    })
    toast.add({ title: t('admin.toasts.bannerRemoved'), color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: t('admin.toasts.bannerUploadError'), color: 'error' })
  } finally {
    isRemovingBanner.value = false
  }
}

// ─── Add vote ─────────────────────────────────────────────────────────────────

const newVoteName = ref('')
const isAddingVote = ref(false)
const showDeleteEventModal = ref(false)
const isDeletingEvent = ref(false)

async function addVote() {
  if (!newVoteName.value.trim()) return
  isAddingVote.value = true
  try {
    const { data } = await $fetch<{ data: AdminEventVote }>(`/api/admin/events/${eventId}/votes`, {
      method: 'POST',
      body: { name: newVoteName.value },
    })
    toast.add({ title: t('admin.toasts.voteCreated'), color: 'success' })
    newVoteName.value = ''
    expandedVoteIds.value = new Set([data.id])
    await refresh()
    await nextTick()
    setTimeout(() => {
      document
        .getElementById(`admin-vote-card-${data.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  } catch {
    toast.add({ title: t('admin.toasts.voteCreateError'), color: 'error' })
  } finally {
    isAddingVote.value = false
  }
}

async function deleteEvent() {
  isDeletingEvent.value = true
  try {
    await $fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' })
    toast.add({ title: t('admin.toasts.eventDeleted'), color: 'success' })
    await navigateTo(localePath('/admin/events'))
  } catch {
    toast.add({ title: t('admin.toasts.eventDeleteError'), color: 'error' })
  } finally {
    isDeletingEvent.value = false
    showDeleteEventModal.value = false
  }
}

// ─── Targeted patch helpers (avoid full refresh for non-structural changes) ───

function patchVote(voteId: string, fields: Partial<AdminEventVote>) {
  if (!eventData.value?.data) return
  eventData.value = {
    data: {
      ...eventData.value.data,
      votes: eventData.value.data.votes.map((v) => (v.id === voteId ? { ...v, ...fields } : v)),
    },
  }
}

function patchOption(voteId: string, optionId: string, fields: Partial<AdminEventVoteOption>) {
  if (!eventData.value?.data) return
  eventData.value = {
    data: {
      ...eventData.value.data,
      votes: eventData.value.data.votes.map((v) =>
        v.id === voteId
          ? {
              ...v,
              options: v.options.map((o) => (o.id === optionId ? { ...o, ...fields } : o)),
            }
          : v
      ),
    },
  }
}

function toggleVotePanel(voteId: string) {
  const next = new Set(expandedVoteIds.value)
  if (next.has(voteId)) next.delete(voteId)
  else next.add(voteId)
  expandedVoteIds.value = next
}

function toggleAllVotePanels() {
  if (!ev.value?.votes.length) return
  expandedVoteIds.value = allVotesExpanded.value
    ? new Set()
    : new Set(ev.value.votes.map((vote) => vote.id))
}

// ─── SSE: refresh on external vote-status-change ──────────────────────────────

useSSEConnection({
  url: '/api/sse/votes',
  onEvent(type, data) {
    if (type === 'vote-status-change' || type === 'content-changed') {
      void refresh()
      return
    }
    if (type === 'vote-count-update') {
      const payload = data as { voteId?: string; options?: AdminEventVoteOption[] }
      if (!payload.voteId || !Array.isArray(payload.options) || !eventData.value?.data) return
      const vote = eventData.value.data.votes.find((entry) => entry.id === payload.voteId)
      if (!vote) return
      vote.options = payload.options.map((option) => ({ ...option, shortcut: null }))
    }
  },
})
</script>

<template>
  <div v-if="ev" class="animate-fade-slide-up space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink
          :to="localePath('/admin/events')"
          class="text-muted hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <UIcon name="i-tabler-arrow-left" class="size-4" aria-hidden="true" />
          {{ t('admin.viewEvents') }}
        </NuxtLink>
        <h1 class="text-2xl font-bold">{{ ev.name }}</h1>
      </div>
      <UButton
        icon="i-tabler-trash"
        color="error"
        variant="subtle"
        @click="showDeleteEventModal = true"
      >
        {{ t('admin.deleteEvent') }}
      </UButton>
    </div>

    <!-- Event details card -->
    <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">{{ t('admin.eventDetails') }}</h2>

      <!-- Banner -->
      <div class="mb-6">
        <div
          v-if="bannerPreview || ev.banner"
          class="bg-muted relative aspect-7/2 w-full overflow-hidden rounded-lg"
        >
          <img
            v-if="bannerPreview"
            :src="bannerPreview"
            :alt="ev.name"
            class="size-full object-cover opacity-70"
          />
          <NuxtImg
            v-else-if="ev.banner"
            :src="ev.banner"
            :alt="ev.name"
            class="size-full object-cover"
            width="700"
            height="200"
          />
          <div
            v-if="isUploadingBanner"
            class="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <UIcon name="i-tabler-loader-2" class="size-8 animate-spin text-white" />
          </div>
        </div>
        <input
          ref="bannerInput"
          type="file"
          accept="image/*"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          @change="onBannerFileSelected"
        />
        <div class="mt-3 flex gap-2">
          <UButton
            :icon="ev.banner ? 'i-tabler-refresh' : 'i-tabler-upload'"
            variant="subtle"
            :loading="isUploadingBanner"
            @click="bannerInput?.click()"
          >
            {{ ev.banner ? t('admin.changeBanner') : t('admin.uploadBanner') }}
          </UButton>
          <UButton
            v-if="ev.banner"
            icon="i-tabler-x"
            variant="ghost"
            color="error"
            :loading="isRemovingBanner"
            @click="removeBanner"
          >
            {{ t('admin.removeBanner') }}
          </UButton>
        </div>
      </div>

      <form class="space-y-4" @submit.prevent="updateEvent">
        <UFormField :label="t('admin.name')" class="w-full">
          <UInput v-model="editForm.name" size="xl" class="w-full text-xl" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('events.startDate')">
            <AppDatePicker v-model="editForm.startDate" size="lg" />
          </UFormField>
          <UFormField :label="t('events.endDate')">
            <AppDatePicker v-model="editForm.endDate" size="lg" />
          </UFormField>
        </div>
        <div class="flex justify-end">
          <UButton type="submit" color="primary">{{ t('admin.saveChanges') }}</UButton>
        </div>
      </form>
    </div>

    <!-- Votes section -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">{{ t('admin.votesSection') }}</h2>
        <UButton
          v-if="ev.votes?.length"
          icon="i-tabler-layout-list"
          variant="subtle"
          color="neutral"
          size="sm"
          :aria-expanded="allVotesExpanded"
          @click="toggleAllVotePanels"
        >
          {{ allVotesExpanded ? t('admin.collapseAllVotes') : t('admin.expandAllVotes') }}
        </UButton>
      </div>

      <!-- Add vote form -->
      <div
        class="border-default bg-default flex items-center gap-3 rounded-xl border p-4 shadow-sm"
      >
        <UInput
          v-model="newVoteName"
          :placeholder="t('admin.voteNamePlaceholder')"
          :aria-label="t('admin.voteNamePlaceholder')"
          class="flex-1"
          @keydown.enter.prevent="addVote"
        />
        <UButton
          icon="i-tabler-plus"
          color="primary"
          :loading="isAddingVote"
          :disabled="!newVoteName.trim()"
          @click="addVote"
        >
          {{ t('admin.addVote') }}
        </UButton>
      </div>

      <!-- Vote panels -->
      <AdminVotePanel
        v-for="vote in ev.votes"
        :key="vote.id"
        :vote="vote"
        :event-id="eventId"
        :expanded="expandedVoteIds.has(vote.id)"
        @toggle="toggleVotePanel(vote.id)"
        @refresh="refresh"
        @update-vote="(fields) => patchVote(vote.id, fields)"
        @update-option="(optionId, fields) => patchOption(vote.id, optionId, fields)"
      />

      <div v-if="!ev.votes?.length" class="py-8 text-center">
        <p class="text-muted">{{ t('admin.noVotesYet') }}</p>
      </div>
    </div>

    <UModal v-model:open="showDeleteEventModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('admin.deleteEvent') }}</h3>
          <p class="text-muted mt-2">{{ t('admin.deleteEventConfirm') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showDeleteEventModal = false">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton color="error" :loading="isDeletingEvent" @click="deleteEvent">
              {{ t('admin.delete') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
