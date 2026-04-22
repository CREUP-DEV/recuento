<script setup lang="ts">
const { t } = useI18n()

interface EventListResponse {
  data: Array<{
    id: string
    name: string
    banner: string | null
    startDate: string
    endDate: string
  }>
}

const { data } = await useFetch<EventListResponse>('/api/events')
const eventList = computed(() => data.value?.data ?? [])

useSeoMeta({ title: () => t('events.title') })
</script>

<template>
  <div class="animate-fade-slide-up mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <h1 class="font-heading mb-8 text-3xl font-bold tracking-tight">
      {{ t('events.title') }}
    </h1>

    <div v-if="eventList.length > 0" class="stagger-list grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <EventCard
        v-for="ev in eventList"
        :id="ev.id"
        :key="ev.id"
        :name="ev.name"
        :banner="ev.banner"
        :start-date="ev.startDate"
        :end-date="ev.endDate"
      />
    </div>

    <div v-else class="py-24 text-center">
      <UIcon name="i-tabler-calendar-off" class="text-muted mx-auto size-12" />
      <p class="text-muted mt-4 text-lg">{{ t('events.noEvents') }}</p>
    </div>
  </div>
</template>
