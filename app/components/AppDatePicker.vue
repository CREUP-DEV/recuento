<script setup lang="ts">
import { parseDate, getLocalTimeZone } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

const { t, locale } = useI18n()

const props = defineProps<{
  modelValue: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
type CalendarRangeValue = { start?: DateValue; end?: DateValue }
type CalendarValue = DateValue | CalendarRangeValue | DateValue[] | null | undefined

const calendarValue = computed(() => {
  if (!props.modelValue) return undefined
  try {
    return parseDate(props.modelValue)
  } catch {
    return undefined
  }
})

function formatDisplay(dateStr: string): string {
  if (!dateStr) return t('admin.selectDate')
  try {
    const d = parseDate(dateStr)
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(
      d.toDate(getLocalTimeZone())
    )
  } catch {
    return dateStr
  }
}

function isSingleDateValue(value: CalendarValue): value is DateValue {
  if (value == null || Array.isArray(value)) {
    return false
  }

  return !('start' in value)
}

function onSelect(val: CalendarValue) {
  if (!isSingleDateValue(val)) {
    return
  }

  emit('update:modelValue', val.toString())
  isOpen.value = false
}
</script>

<template>
  <UPopover v-model:open="isOpen" :content="{ align: 'start' }">
    <UButton
      variant="outline"
      color="neutral"
      icon="i-tabler-calendar"
      :size="size ?? 'md'"
      class="w-full justify-start font-normal"
      :class="!modelValue ? 'text-muted' : ''"
    >
      {{ formatDisplay(modelValue) }}
    </UButton>
    <template #content>
      <UCalendar :model-value="calendarValue" @update:model-value="onSelect" />
    </template>
  </UPopover>
</template>
