<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  modelValue: {
    name: string
    startDate: string
    endDate: string
  }
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: typeof props.modelValue]
  submit: []
  cancel: []
}>()

function update(field: keyof typeof props.modelValue, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="emit('submit')">
    <UFormField :label="t('admin.name')">
      <UInput
        :value="modelValue.name"
        :placeholder="t('admin.eventNamePlaceholder')"
        size="lg"
        @input="update('name', ($event.target as HTMLInputElement).value)"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="t('events.startDate')">
        <UInput
          :value="modelValue.startDate"
          type="date"
          size="lg"
          @input="update('startDate', ($event.target as HTMLInputElement).value)"
        />
      </UFormField>
      <UFormField :label="t('events.endDate')">
        <UInput
          :value="modelValue.endDate"
          type="date"
          size="lg"
          @input="update('endDate', ($event.target as HTMLInputElement).value)"
        />
      </UFormField>
    </div>

    <slot />

    <div class="flex justify-end gap-3">
      <UButton variant="ghost" color="neutral" type="button" @click="emit('cancel')">
        {{ t('admin.cancel') }}
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ submitLabel ?? t('admin.save') }}
      </UButton>
    </div>
  </form>
</template>
