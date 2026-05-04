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
  slug: string
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
  slug: string
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
const eventParam = route.params.id as string

const { data: eventData, refresh } = await useFetch<{ data: AdminEventData }>(
  `/api/admin/events/${eventParam}`
)
const ev = computed(() => eventData.value?.data)
const eventId = computed(() => ev.value?.id ?? eventParam)
const expandedVoteIds = ref<Set<string>>(new Set())
const allVotesExpanded = computed(() => {
  const votes = ev.value?.votes ?? []
  return votes.length > 0 && votes.every((vote) => expandedVoteIds.value.has(vote.id))
})

function scrollToAdminVote(voteId: string) {
  document
    .getElementById(`admin-vote-card-${voteId}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function expandAndScrollToVote(voteId: string) {
  expandedVoteIds.value = new Set([...expandedVoteIds.value, voteId])
  await nextTick()
  setTimeout(() => scrollToAdminVote(voteId), 50)
}

async function expandAndScrollToOpenVote() {
  const openVote = ev.value?.votes.find((vote) => vote.open)
  if (openVote) await expandAndScrollToVote(openVote.id)
}

if (!ev.value) {
  throw createError({ statusCode: 404, statusMessage: t('errors.eventNotFound') })
}

onMounted(() => {
  void expandAndScrollToOpenVote()
})

function toDateInput(ts: string | null | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : ''
}

function syncEditForm(data: Pick<AdminEventData, 'name' | 'slug' | 'startDate' | 'endDate'>) {
  editForm.value.name = data.name
  editForm.value.slug = data.slug
  editForm.value.startDate = toDateInput(data.startDate)
  editForm.value.endDate = toDateInput(data.endDate)
}

// ─── Event editing ────────────────────────────────────────────────────────────

const editForm = ref({
  name: ev.value?.name ?? '',
  slug: ev.value?.slug ?? '',
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
    editForm.value.slug !== ev.value.slug ||
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
      data: Pick<AdminEventData, 'id' | 'name' | 'slug' | 'banner' | 'startDate' | 'endDate'>
    }>(`/api/admin/events/${eventId.value}`, {
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
    await $fetch(`/api/admin/events/${eventId.value}/banner`, {
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
    await $fetch(`/api/admin/events/${eventId.value}`, {
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
    const { data } = await $fetch<{ data: AdminEventVote }>(
      `/api/admin/events/${eventId.value}/votes`,
      {
        method: 'POST',
        body: { name: newVoteName.value },
      }
    )
    toast.add({ title: t('admin.toasts.voteCreated'), color: 'success' })
    newVoteName.value = ''
    expandedVoteIds.value = new Set([data.id])
    await refresh()
    await nextTick()
    setTimeout(() => scrollToAdminVote(data.id), 50)
  } catch {
    toast.add({ title: t('admin.toasts.voteCreateError'), color: 'error' })
  } finally {
    isAddingVote.value = false
  }
}

async function deleteEvent() {
  isDeletingEvent.value = true
  try {
    await $fetch(`/api/admin/events/${eventId.value}`, { method: 'DELETE' })
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

const { isConnected: adminRealtimeConnected } = useSSEConnection({
  url: '/api/sse/votes',
  onEvent(type, payload) {
    if (type === 'vote-status-change') {
      const data = payload as { eventId?: string; open?: boolean; voteId?: string }
      void refresh().then(() => {
        if ((!data.eventId || data.eventId === eventId.value) && data.open && data.voteId) {
          void expandAndScrollToVote(data.voteId)
        }
      })
      return
    }
    if (type === 'content-changed') {
      void refresh()
      return
    }
    if (type === 'vote-count-update') {
      const data = payload as { voteId?: string; options?: AdminEventVoteOption[] }
      if (!data.voteId || !Array.isArray(data.options) || !eventData.value?.data) return
      const vote = eventData.value.data.votes.find((entry) => entry.id === data.voteId)
      if (!vote) return
      vote.options = data.options.map((option) => ({ ...option, shortcut: null }))
    }
  },
})
const adminRealtimeStatus = computed(() =>
  adminRealtimeConnected.value ? t('admin.realtimeConnected') : t('admin.realtimeDisconnected')
)
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
    <div
      class="border-default bg-default inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      aria-live="polite"
    >
      <span
        class="size-2 rounded-full"
        :class="adminRealtimeConnected ? 'bg-green-500' : 'bg-amber-500'"
        aria-hidden="true"
      />
      {{ adminRealtimeStatus }}
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
        <UFormField :label="t('admin.slug')" class="w-full">
          <UInput
            v-model="editForm.slug"
            size="lg"
            class="w-full font-mono"
            :placeholder="t('admin.slugPlaceholder')"
          />
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
        @refresh="
          async (focusVoteId) => {
            await refresh()
            if (focusVoteId) await expandAndScrollToVote(focusVoteId)
          }
        "
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
