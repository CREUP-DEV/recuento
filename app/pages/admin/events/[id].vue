<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AdminEventVoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
}

interface AdminEventVote {
  id: string
  name: string
  open: boolean
  visible: boolean
  startedAt: string | null
  endedAt: string | null
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
const eventId = route.params.id as string

const { data: eventData, refresh } = await useFetch<{ data: AdminEventData }>(
  `/api/admin/events/${eventId}`
)
const ev = computed(() => eventData.value?.data)

if (!ev.value) {
  throw createError({ statusCode: 404, statusMessage: 'Evento no encontrado' })
}

function toDateInput(ts: string | null | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : ''
}

// ─── Event editing ────────────────────────────────────────────────────────────

const editForm = ref({
  name: ev.value?.name ?? '',
  startDate: toDateInput(ev.value?.startDate),
  endDate: toDateInput(ev.value?.endDate),
})

watch(ev, (val) => {
  if (val) {
    editForm.value.name = val.name
    editForm.value.startDate = toDateInput(val.startDate)
    editForm.value.endDate = toDateInput(val.endDate)
  }
})

async function updateEvent() {
  try {
    await $fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      body: editForm.value,
    })
    toast.add({ title: t('admin.toasts.eventUpdated'), color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: t('admin.toasts.eventUpdateError'), color: 'error' })
  }
}

// ─── Banner upload ────────────────────────────────────────────────────────────

const bannerInput = ref<HTMLInputElement | null>(null)
const isUploadingBanner = ref(false)

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
    await refresh()
  } catch {
    toast.add({ title: t('admin.toasts.bannerUploadError'), color: 'error' })
  } finally {
    isUploadingBanner.value = false
    if (target) target.value = ''
  }
}

// ─── Add vote ─────────────────────────────────────────────────────────────────

const newVoteName = ref('')
const isAddingVote = ref(false)

async function addVote() {
  if (!newVoteName.value.trim()) return
  isAddingVote.value = true
  try {
    await $fetch(`/api/admin/events/${eventId}/votes`, {
      method: 'POST',
      body: { name: newVoteName.value },
    })
    toast.add({ title: t('admin.toasts.voteCreated'), color: 'success' })
    newVoteName.value = ''
    await refresh()
  } catch {
    toast.add({ title: t('admin.toasts.voteCreateError'), color: 'error' })
  } finally {
    isAddingVote.value = false
  }
}

// ─── Targeted patch helpers (avoid full refresh for non-structural changes) ───

function patchVote(voteId: string, fields: Partial<AdminEventVote>) {
  if (!eventData.value?.data) return
  const vote = eventData.value.data.votes.find((v) => v.id === voteId)
  if (vote) Object.assign(vote, fields)
}

function patchOption(voteId: string, optionId: string, fields: Partial<AdminEventVoteOption>) {
  if (!eventData.value?.data) return
  const vote = eventData.value.data.votes.find((v) => v.id === voteId)
  const option = vote?.options.find((o) => o.id === optionId)
  if (option) Object.assign(option, fields)
}

// ─── SSE: refresh on external vote-status-change ──────────────────────────────

onMounted(() => {
  if (import.meta.server) return

  const sse = new EventSource('/api/sse/votes')

  sse.addEventListener('vote-status-change', () => refresh())
  sse.addEventListener('vote-count-update', (rawEvent) => {
    try {
      const payload = JSON.parse((rawEvent as MessageEvent<string>).data) as {
        voteId?: string
        options?: AdminEventVoteOption[]
      }

      if (!payload.voteId || !Array.isArray(payload.options) || !eventData.value?.data) {
        return
      }

      const vote = eventData.value.data.votes.find((entry) => entry.id === payload.voteId)

      if (!vote) {
        return
      }

      vote.options = payload.options.map((option) => ({ ...option, shortcut: null }))
    } catch {
      // Ignore malformed SSE payloads
    }
  })

  onBeforeUnmount(() => sse.close())
})
</script>

<template>
  <div v-if="ev" class="animate-fade-slide-up space-y-8">
    <h1 class="text-2xl font-bold">{{ ev.name }}</h1>

    <!-- Event details card -->
    <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">{{ t('admin.eventDetails') }}</h2>

      <!-- Banner -->
      <div class="mb-6">
        <div
          v-if="ev.banner"
          class="bg-muted relative aspect-7/2 w-full overflow-hidden rounded-lg"
        >
          <NuxtImg
            :src="ev.banner"
            :alt="ev.name"
            class="size-full object-cover"
            width="700"
            height="200"
          />
        </div>
        <input
          ref="bannerInput"
          type="file"
          accept="image/*"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          @change="uploadBanner"
        />
        <UButton
          :icon="ev.banner ? 'i-tabler-refresh' : 'i-tabler-upload'"
          variant="subtle"
          class="mt-3"
          :loading="isUploadingBanner"
          @click="bannerInput?.click()"
        >
          {{ ev.banner ? t('admin.changeBanner') : t('admin.uploadBanner') }}
        </UButton>
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
      <h2 class="text-lg font-semibold">{{ t('admin.votesSection') }}</h2>

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
        @refresh="refresh"
        @update-vote="(fields) => patchVote(vote.id, fields)"
        @update-option="(optionId, fields) => patchOption(vote.id, optionId, fields)"
      />

      <div v-if="!ev.votes?.length" class="py-8 text-center">
        <p class="text-muted">{{ t('admin.noVotesYet') }}</p>
      </div>
    </div>
  </div>
</template>
