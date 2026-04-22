<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { activeVote } = useActiveVote()
const route = useRoute()

const isOnLivePage = computed(() => {
  if (!activeVote.value) return true
  return route.path.includes(`/votes/${activeVote.value.id}`)
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-95"
  >
    <NuxtLink
      v-if="activeVote && !isOnLivePage"
      :to="localePath(`/votes/${activeVote.id}`)"
      class="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition-all hover:bg-red-700 hover:shadow-xl hover:shadow-red-500/40 active:scale-95"
      :aria-label="t('votes.backToLive')"
    >
      <span class="relative flex size-2.5">
        <span
          class="animate-pulse-live absolute inline-flex size-full rounded-full bg-red-300 opacity-75"
        />
        <span class="relative inline-flex size-2.5 rounded-full bg-white" />
      </span>
      {{ t('votes.backToLive') }}
    </NuxtLink>
  </Transition>
</template>
