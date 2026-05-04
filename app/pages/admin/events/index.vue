<script setup lang="ts">
definePageMeta({
  layout: 'admin',
})

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { formatDateShort } = useLocaleFormatting()

const { data: eventsData, refresh } = await useFetch('/api/admin/events')
const events = computed(() => eventsData.value?.data ?? [])

const showDeleteModal = ref(false)
const eventToDelete = ref<string | null>(null)

function confirmDelete(id: string) {
  eventToDelete.value = id
  showDeleteModal.value = true
}

async function deleteEvent() {
  if (!eventToDelete.value) return

  try {
    await $fetch(`/api/admin/events/${eventToDelete.value}`, { method: 'DELETE' })
    toast.add({ title: t('admin.toasts.eventDeleted'), color: 'success' })
    showDeleteModal.value = false
    eventToDelete.value = null
    await refresh()
  } catch {
    toast.add({ title: t('admin.toasts.eventDeleteError'), color: 'error' })
  }
}

async function toggleVisibility(ev: { id: string; visible: boolean }) {
  const newVisible = !ev.visible
  const entry = eventsData.value?.data?.find((e) => e.id === ev.id)
  if (entry) entry.visible = newVisible
  try {
    await $fetch(`/api/admin/events/${ev.id}`, {
      method: 'PATCH',
      body: { visible: newVisible },
    })
  } catch {
    if (entry) entry.visible = ev.visible
    toast.add({
      title: t('admin.toasts.visibilityError'),
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="animate-fade-slide-up space-y-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{ t('admin.events') }}</h1>
      <UButton :to="localePath('/admin/events/new')" icon="i-tabler-plus" color="primary">
        {{ t('admin.newEvent') }}
      </UButton>
    </div>

    <div v-if="events.length > 0" class="space-y-3">
      <div
        v-for="ev in events"
        :key="ev.id"
        class="border-default bg-default hover-card group relative grid gap-3 rounded-xl border p-3 shadow-sm transition hover:shadow sm:flex sm:items-center sm:gap-4 sm:p-4"
      >
        <!-- Banner thumbnail -->
        <NuxtLink
          :to="localePath(`/admin/events/${ev.slug || ev.id}`)"
          class="focus-visible:ring-primary/60 absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
          :aria-label="t('admin.openEvent', { name: ev.name })"
        />

        <div class="bg-muted aspect-video w-full overflow-hidden rounded-lg sm:w-28 sm:shrink-0">
          <NuxtImg
            v-if="ev.banner"
            :src="ev.banner"
            :alt="ev.name"
            class="size-full object-cover"
            width="112"
            height="63"
          />
          <div v-else class="flex size-full items-center justify-center">
            <UIcon name="i-tabler-photo" class="text-muted size-5" />
          </div>
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <p class="event-title wrap-break-words leading-snug font-semibold transition-colors">
            {{ ev.name }}
          </p>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ formatDateShort(ev.startDate) }} - {{ formatDateShort(ev.endDate) }} ·
            {{ $t('events.votesCount', { count: ev.votes?.length ?? 0 }, ev.votes?.length ?? 0) }}
          </p>
        </div>

        <!-- Actions -->
        <div
          class="relative z-10 flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-start"
        >
          <UButton
            :color="ev.visible ? 'success' : 'neutral'"
            variant="subtle"
            size="xs"
            :aria-pressed="ev.visible"
            @click="toggleVisibility(ev)"
          >
            {{ ev.visible ? t('admin.visible') : t('admin.hidden') }}
          </UButton>
          <UButton
            icon="i-tabler-trash"
            variant="ghost"
            color="error"
            size="sm"
            :aria-label="t('admin.deleteEvent')"
            @click="confirmDelete(ev.id)"
          />
        </div>
      </div>
    </div>

    <div v-else class="py-16 text-center">
      <UIcon name="i-tabler-calendar-off" class="text-muted mx-auto size-16" />
      <p class="text-muted mt-4 text-lg">{{ t('admin.noEvents') }}</p>
      <UButton :to="localePath('/admin/events/new')" icon="i-tabler-plus" class="mt-4">
        {{ t('admin.createFirstEvent') }}
      </UButton>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('admin.deleteEvent') }}</h3>
          <p class="text-muted mt-2">{{ t('admin.deleteEventConfirm') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showDeleteModal = false">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton color="error" @click="deleteEvent">{{ t('admin.delete') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
