<script setup lang="ts">
import type { ActiveVoteData } from '~/composables/useActiveVote'

const { t } = useI18n()
const localePath = useLocalePath()

interface PublicEventListResponse {
  data: Array<{
    id: string
    name: string
    banner: string | null
    startDate: string
    endDate: string
  }>
}

const { data: activeData } = await useFetch<{ data: ActiveVoteData | null }>('/api/votes/active')
const activeVote = computed(() => activeData.value?.data ?? null)

const { data: eventsData } = await useFetch<PublicEventListResponse>('/api/events')
const events = computed(() => eventsData.value?.data ?? [])

useSeoMeta({
  title: t('app.title'),
  description: t('app.description'),
})
</script>

<template>
  <UContainer class="py-8 sm:py-12 lg:py-16">
    <!-- Live vote banner -->
    <NuxtLink
      v-if="activeVote"
      :to="localePath(`/votes/${activeVote.id}`)"
      class="mb-8 flex items-center gap-3 rounded-xl bg-linear-to-r from-red-600 to-red-700 px-5 py-4 text-white transition hover:opacity-90 dark:from-red-800 dark:to-red-900"
    >
      <span class="relative flex size-3">
        <span
          class="animate-pulse-live absolute inline-flex size-full rounded-full bg-white opacity-75"
        />
        <span class="relative inline-flex size-3 rounded-full bg-white" />
      </span>
      <span class="text-lg font-bold">{{ t('votes.activeNow') }}</span>
      <span class="text-white/80">-</span>
      <span class="font-medium">{{ activeVote.name }}</span>
      <UIcon name="i-tabler-arrow-right" class="ml-auto size-5" />
    </NuxtLink>

    <!-- Local vote tool -->
    <NuxtLink
      :to="localePath('/local')"
      class="border-default bg-default hover:bg-muted/30 group mb-8 flex items-center gap-6 rounded-2xl border p-6 transition sm:p-8"
    >
      <div
        class="bg-primary/10 text-primary flex size-14 shrink-0 items-center justify-center rounded-xl"
      >
        <UIcon name="i-tabler-chart-bar" class="size-7" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-lg font-semibold">{{ t('localVote.title') }}</p>
        <p class="text-muted mt-0.5 text-sm">{{ t('localVote.description') }}</p>
      </div>
      <UIcon
        name="i-tabler-arrow-right"
        class="text-muted size-5 shrink-0 transition-transform group-hover:translate-x-1"
      />
    </NuxtLink>

    <!-- Events grid -->
    <div class="animate-fade-slide-up mb-8">
      <h1 class="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        {{ t('events.title') }}
      </h1>
    </div>

    <div v-if="events.length > 0" class="stagger-list grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <EventCard
        v-for="ev in events"
        :id="ev.id"
        :key="ev.id"
        :name="ev.name"
        :banner="ev.banner"
        :start-date="ev.startDate"
        :end-date="ev.endDate"
      />
    </div>

    <div v-else class="animate-fade-in py-24 text-center">
      <UIcon name="i-tabler-calendar-off" class="text-muted mx-auto size-16" />
      <p class="text-muted mt-4 text-lg">{{ t('events.noEvents') }}</p>
    </div>
  </UContainer>
</template>
