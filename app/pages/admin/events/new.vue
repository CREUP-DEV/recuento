<script setup lang="ts">
definePageMeta({
  layout: 'admin',
})

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const localePath = useLocalePath()

const form = ref({
  name: '',
  startDate: '',
  endDate: '',
})

const isSubmitting = ref(false)

interface CreateEventResponse {
  data: {
    id: string
  }
}

async function submit() {
  if (!form.value.name || !form.value.startDate || !form.value.endDate) {
    toast.add({ title: t('admin.toasts.fieldsRequired'), color: 'warning' })
    return
  }

  isSubmitting.value = true
  try {
    const result = await $fetch<CreateEventResponse>('/api/admin/events', {
      method: 'POST',
      body: form.value,
    })
    toast.add({ title: t('admin.toasts.eventCreated'), color: 'success' })
    router.push(localePath(`/admin/events/${result.data.id}`))
  } catch {
    toast.add({ title: t('admin.toasts.eventCreateError'), color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="animate-fade-slide-up mx-auto max-w-4xl">
    <h1 class="mb-8 text-2xl font-bold">{{ t('admin.newEvent') }}</h1>

    <form class="space-y-6" @submit.prevent="submit">
      <UFormField :label="t('admin.name')" class="w-full">
        <UInput
          v-model="form.name"
          :placeholder="t('admin.eventNamePlaceholder')"
          size="xl"
          class="w-full text-xl"
        />
      </UFormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField :label="t('events.startDate')">
          <AppDatePicker v-model="form.startDate" size="lg" />
        </UFormField>
        <UFormField :label="t('events.endDate')">
          <AppDatePicker v-model="form.endDate" size="lg" />
        </UFormField>
      </div>

      <div class="flex justify-end gap-3 pt-4">
        <UButton :to="localePath('/admin/events')" variant="ghost" color="neutral">
          {{ t('admin.cancel') }}
        </UButton>
        <UButton type="submit" color="primary" :loading="isSubmitting">
          {{ t('admin.createEvent') }}
        </UButton>
      </div>
    </form>
  </div>
</template>
