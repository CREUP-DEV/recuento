<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { formatDate } = useLocaleFormatting()
const route = useRoute()
const eventId = route.params.id as string

const { data, error, status } = await useFetch(`/api/events/${eventId}`)
const ev = computed(() => data.value?.data)

if (!ev.value && status.value !== 'pending') {
  throw createError({ statusCode: 404, statusMessage: 'Evento no encontrado' })
}

useSeoMeta({
  title: () => ev.value?.name ?? t('events.title'),
})
</script>

<template>
  <div v-if="ev" class="animate-fade-slide-up">
    <!-- Banner hero -->
    <div v-if="ev.banner" class="bg-muted relative aspect-7/2 w-full overflow-hidden">
      <NuxtImg
        :src="ev.banner"
        :alt="ev.name"
        class="size-full object-cover"
        width="1400"
        height="400"
      />
      <div class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-12">
        <h1
          class="font-heading text-3xl font-bold text-white drop-shadow-lg sm:text-4xl lg:text-5xl"
        >
          {{ ev.name }}
        </h1>
        <p class="mt-2 text-white/80">
          {{ formatDate(ev.startDate) }} — {{ formatDate(ev.endDate) }}
        </p>
      </div>
    </div>

    <!-- No banner fallback -->
    <div v-else class="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <h1 class="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        {{ ev.name }}
      </h1>
      <p class="text-muted mt-2">{{ formatDate(ev.startDate) }} — {{ formatDate(ev.endDate) }}</p>
    </div>

    <!-- Votes -->
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h2 class="font-heading mb-6 text-2xl font-bold">{{ t('votes.title') }}</h2>

      <div v-if="ev.votes && ev.votes.length > 0" class="stagger-list space-y-6">
        <div
          v-for="vote in ev.votes"
          :key="vote.id"
          class="border-default bg-default overflow-hidden rounded-xl border shadow-sm"
        >
          <div class="border-default flex items-center justify-between gap-4 border-b px-6 py-4">
            <div class="flex items-center gap-3">
              <NuxtLink
                :to="localePath(`/votes/${vote.id}`)"
                class="font-heading hover:text-creup-red-600 dark:hover:text-creup-red-400 text-lg font-semibold transition-colors"
              >
                {{ vote.name }}
              </NuxtLink>
            </div>
            <VoteStatus :open="vote.open" :started-at="vote.startedAt" :ended-at="vote.endedAt" />
          </div>

          <div class="p-6">
            <template v-if="vote.open">
              <NuxtLink
                :to="localePath(`/votes/${vote.id}`)"
                class="flex items-center justify-center gap-3 rounded-xl bg-linear-to-r from-red-600 to-red-700 px-6 py-5 text-white transition hover:opacity-90 dark:from-red-800 dark:to-red-900"
              >
                <span class="relative flex size-3">
                  <span
                    class="animate-pulse-live absolute inline-flex size-full rounded-full bg-white opacity-75"
                  />
                  <span class="relative inline-flex size-3 rounded-full bg-white" />
                </span>
                <span class="text-lg font-bold">{{ t('votes.activeNow') }}</span>
                <span class="text-white/80">—</span>
                <span class="font-medium">{{ t('votes.viewVote') }}</span>
                <UIcon name="i-tabler-arrow-right" class="ml-auto size-5" />
              </NuxtLink>
            </template>
            <template v-else>
              <VoteChart v-if="vote.options && vote.options.length > 0" :options="vote.options" />
              <p v-else class="text-muted text-sm">{{ t('votes.noVotes') }}</p>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="py-16 text-center">
        <UIcon name="i-tabler-checkbox" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4 text-lg">{{ t('votes.noVotes') }}</p>
      </div>
    </div>
  </div>

  <div v-else-if="error" class="py-24 text-center">
    <UAlert color="error" :title="t('common.error')" />
  </div>
</template>
