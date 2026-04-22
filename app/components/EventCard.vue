<script setup lang="ts">
const { formatDate } = useLocaleFormatting()
const localePath = useLocalePath()

const props = defineProps<{
  id: string
  name: string
  banner: string | null
  startDate: string
  endDate: string
}>()
</script>

<template>
  <NuxtLink
    :to="localePath(`/events/${props.id}`)"
    class="motion-card group border-default bg-default block overflow-hidden rounded-xl border shadow-sm"
  >
    <div class="bg-muted relative aspect-[7/2] w-full overflow-hidden">
      <NuxtImg
        v-if="props.banner"
        :src="props.banner"
        :alt="props.name"
        class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        width="700"
        height="200"
        loading="lazy"
      />
      <div
        v-else
        class="from-creup-red-100 to-creup-blue-100 dark:from-creup-red-950 dark:to-creup-blue-950 flex size-full items-center justify-center bg-gradient-to-br"
      >
        <UIcon
          name="i-tabler-calendar-event"
          class="text-creup-red-400 dark:text-creup-red-600 size-12"
        />
      </div>
    </div>

    <div class="p-4">
      <h3
        class="font-heading group-hover:text-creup-red-600 dark:group-hover:text-creup-red-400 text-lg leading-tight font-semibold transition-colors"
      >
        {{ props.name }}
      </h3>
      <p class="text-muted mt-1 text-sm">
        {{ formatDate(props.startDate) }} — {{ formatDate(props.endDate) }}
      </p>
    </div>
  </NuxtLink>
</template>
