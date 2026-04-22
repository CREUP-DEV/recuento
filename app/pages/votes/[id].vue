<script setup lang="ts">
interface VotePageData {
  id: string
  name: string
  open: boolean
  event: {
    id: string
    name: string
  } | null
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
  }>
}

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const voteId = route.params.id as string

const { data, error } = await useFetch<{ data: VotePageData }>(`/api/votes/${voteId}`)
const vote = computed(() => data.value?.data)

if (!vote.value && error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Votación no encontrada' })
}

const { options: streamOptions, isConnected, lastEvent } = useVoteStream(voteId)

// isOpen starts from fetch, updates reactively via SSE status-change events
const isOpen = ref(vote.value?.open ?? false)
watch(lastEvent, (event) => {
  if (event?.type === 'vote-status-change' && event.voteId === voteId) {
    isOpen.value = event.open
  }
})

const displayOptions = computed(() =>
  streamOptions.value.length > 0 ? streamOptions.value : (vote.value?.options ?? [])
)

const voteName = computed(() => vote.value?.name ?? t('votes.title'))
const eventName = computed(() => vote.value?.event?.name ?? '')
const eventId = computed(() => vote.value?.event?.id ?? null)

const totalVotes = computed(() =>
  displayOptions.value.reduce((sum, option) => sum + option.count, 0)
)

useSeoMeta({
  title: () => voteName.value,
  robots: 'noindex',
})
</script>

<template>
  <div class="animate-fade-slide-up mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
    <!-- Breadcrumb -->
    <div v-if="eventName && eventId" class="mb-4">
      <NuxtLink
        :to="localePath(`/events/${eventId}`)"
        class="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <UIcon name="i-tabler-arrow-left" class="size-4" />
        {{ eventName }}
      </NuxtLink>
    </div>

    <!-- Vote header -->
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {{ voteName }}
        </h1>
        <div class="mt-3 flex items-center gap-3">
          <VoteStatus :open="isOpen" />
          <span
            v-if="isConnected"
            class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
          >
            <span class="relative flex size-1.5">
              <span
                class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
              />
              <span class="relative inline-flex size-1.5 rounded-full bg-green-500" />
            </span>
            {{ t('nav.live') }}
          </span>
        </div>
      </div>

      <div class="text-right">
        <p class="text-muted text-sm">{{ t('votes.total') }}</p>
        <p class="font-mono text-3xl font-bold tabular-nums">{{ totalVotes }}</p>
      </div>
    </div>

    <!-- Vote chart -->
    <div class="border-default bg-default overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-8">
      <VoteChart v-if="displayOptions.length > 0" :options="displayOptions" />
      <div v-else class="py-12 text-center">
        <UIcon name="i-tabler-chart-bar-off" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">{{ t('votes.noVotes') }}</p>
      </div>
    </div>
  </div>
</template>
