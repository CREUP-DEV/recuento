<script setup lang="ts">
definePageMeta({
  layout: 'admin',
})

interface AdminStats {
  totalEvents: number
  activeEvents: number
  openVotes: number
}

const { t } = useI18n()
const localePath = useLocalePath()

const { data: statsData } = await useFetch<{ data: AdminStats }>('/api/admin/stats')
const totalEvents = computed(() => statsData.value?.data.totalEvents ?? 0)
const activeEvents = computed(() => statsData.value?.data.activeEvents ?? 0)
const openVotes = computed(() => statsData.value?.data.openVotes ?? 0)
</script>

<template>
  <div class="animate-fade-slide-up space-y-8">
    <h1 class="text-2xl font-bold">{{ t('admin.dashboard') }}</h1>

    <!-- Stats cards -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="bg-creup-blue-100 dark:bg-creup-blue-950 flex size-10 items-center justify-center rounded-lg"
          >
            <UIcon
              name="i-tabler-calendar-event"
              class="text-creup-blue-600 dark:text-creup-blue-400 size-5"
            />
          </div>
          <div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('admin.totalEvents') }}
            </p>
            <p class="text-2xl font-bold tabular-nums">{{ totalEvents }}</p>
          </div>
        </div>
      </div>

      <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950"
          >
            <UIcon name="i-tabler-eye" class="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('admin.activeEvents') }}
            </p>
            <p class="text-2xl font-bold tabular-nums">{{ activeEvents }}</p>
          </div>
        </div>
      </div>

      <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950"
          >
            <UIcon name="i-tabler-live-photo" class="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('admin.openVotes') }}</p>
            <p class="text-2xl font-bold tabular-nums">{{ openVotes }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="border-default bg-default rounded-xl border p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">{{ t('admin.quickActions') }}</h2>
      <div class="flex flex-wrap gap-3">
        <UButton :to="localePath('/admin/events/new')" icon="i-tabler-plus" color="primary">
          {{ t('admin.newEvent') }}
        </UButton>
        <UButton
          :to="localePath('/admin/events')"
          icon="i-tabler-list"
          color="neutral"
          variant="subtle"
        >
          {{ t('admin.viewEvents') }}
        </UButton>
        <UButton
          :to="localePath('/')"
          icon="i-tabler-external-link"
          color="neutral"
          variant="ghost"
          target="_blank"
        >
          {{ t('nav.viewPublicSite') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
