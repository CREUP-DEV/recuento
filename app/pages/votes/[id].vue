<script setup lang="ts">
import { calculateWinners } from '~~/shared/utils/winnerCalculation'

interface VotePageData {
  id: string
  name: string
  open: boolean
  minimumVotes: number | null
  maxWinners: number | null
  confettiEnabled: boolean
  event: {
    id: string
    name: string
  } | null
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
    canWin: boolean
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

const {
  options: streamOptions,
  minimumVotes: streamMinimumVotes,
  winnerIds: streamWinnerIds,
  isConnected,
  lastEvent,
} = useVoteStream(voteId)

const { launchConfetti } = useConfetti()

// isOpen starts from fetch, updates reactively via SSE status-change events
const isOpen = ref(vote.value?.open ?? false)
watch(lastEvent, (event) => {
  if (event?.type === 'vote-status-change' && event.voteId === voteId) {
    isOpen.value = event.open
  }
  if (
    event?.type === 'vote-closed' &&
    event.voteId === voteId &&
    event.confettiEnabled &&
    event.winnerIds.length > 0
  ) {
    launchConfetti()
  }
})

const displayOptions = computed(() =>
  streamOptions.value.length > 0 ? streamOptions.value : (vote.value?.options ?? [])
)

// Calculate winners from initial fetch data (for closed votes on page load).
// Uses isOpen (reactive) so winners clear when vote is reopened via SSE.
const initialWinnerIds = computed(() => {
  if (!vote.value || isOpen.value) return []
  return [
    ...calculateWinners(
      vote.value.options.map((o) => ({ id: o.id, count: o.count, canWin: o.canWin })),
      vote.value.minimumVotes,
      vote.value.maxWinners
    ).winnerIds,
  ]
})

const displayWinnerIds = computed(() =>
  streamWinnerIds.value.length > 0 ? streamWinnerIds.value : initialWinnerIds.value
)

const displayMinimumVotes = computed(
  () => streamMinimumVotes.value ?? vote.value?.minimumVotes ?? null
)

// Labels for winner options (for the list display)
const winnerOptions = computed(() =>
  displayOptions.value.filter((o) => displayWinnerIds.value.includes(o.id))
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
  <div class="animate-fade-slide-up mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
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
            class="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"
          >
            <span class="relative flex size-2">
              <span
                class="animate-pulse-live absolute inline-flex size-full rounded-full bg-green-400 opacity-75"
              />
              <span class="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            {{ t('nav.live') }}
          </span>
        </div>
      </div>

      <div class="text-right">
        <p class="text-muted text-base">{{ t('votes.total') }}</p>
        <p class="font-mono text-4xl font-bold tabular-nums">{{ totalVotes }}</p>
      </div>
    </div>

    <!-- Winners list (post-close) -->
    <div
      v-if="!isOpen && winnerOptions.length > 0"
      class="border-default bg-default mb-6 overflow-hidden rounded-2xl border p-6 shadow-sm"
    >
      <p class="text-muted mb-3 text-base font-semibold tracking-wide uppercase">
        {{ t('votes.winners') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="option in winnerOptions"
          :key="option.id"
          class="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-base font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          <UIcon name="i-tabler-trophy" class="size-5" />
          {{ option.label }}
        </span>
      </div>
    </div>

    <!-- Vote chart -->
    <div class="border-default bg-default overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-8">
      <VoteChart
        v-if="displayOptions.length > 0"
        :options="displayOptions"
        :winner-ids="displayWinnerIds"
        :minimum-votes="displayMinimumVotes"
      />
      <div v-else class="py-12 text-center">
        <UIcon name="i-tabler-chart-bar-off" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">{{ t('votes.noVotes') }}</p>
      </div>
    </div>
  </div>
</template>
