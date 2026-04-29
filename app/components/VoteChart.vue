<script setup lang="ts">
import { getOptionDisplayColor } from '~~/shared/utils/votePresentation'

const { t } = useI18n()
const { formatNumber } = useLocaleFormatting()

const props = defineProps<{
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
    canWin?: boolean
    thresholdReached?: boolean
  }>
  minimumVotes?: number | null
  winnerIds?: string[]
  isOpen?: boolean
}>()

const displayOptions = computed(() =>
  props.isOpen ? props.options : [...props.options].sort((a, b) => b.count - a.count)
)

const totalVotes = computed(() => props.options.reduce((sum, o) => sum + o.count, 0))
const liveAnnouncement = ref('')
let liveAnnouncementTimeout: ReturnType<typeof setTimeout> | null = null

function isWinner(optionId: string) {
  return props.winnerIds ? props.winnerIds.includes(optionId) : false
}

watch(
  () =>
    props.options.map((option) => ({ id: option.id, label: option.label, count: option.count })),
  (nextOptions, previousOptions) => {
    if (!previousOptions || previousOptions.length === 0) {
      return
    }

    const changedOption = nextOptions.find((option) => {
      const previousOption = previousOptions.find((entry) => entry.id === option.id)
      return previousOption && previousOption.count !== option.count
    })

    if (!changedOption) {
      return
    }

    const previousOption = previousOptions.find((option) => option.id === changedOption.id)
    if (!previousOption) {
      return
    }

    liveAnnouncement.value = t(
      changedOption.count > previousOption.count
        ? 'accessibility.voteCountIncreased'
        : 'accessibility.voteCountDecreased',
      {
        option: changedOption.label,
        count: formatNumber(changedOption.count),
      }
    )

    if (liveAnnouncementTimeout) {
      clearTimeout(liveAnnouncementTimeout)
    }

    liveAnnouncementTimeout = setTimeout(() => {
      liveAnnouncement.value = ''
      liveAnnouncementTimeout = null
    }, 1_500)
  }
)

onBeforeUnmount(() => {
  if (liveAnnouncementTimeout) {
    clearTimeout(liveAnnouncementTimeout)
  }
})

const roundedPcts = computed(() => {
  const total = totalVotes.value
  if (total === 0) return displayOptions.value.map(() => 0)

  const exact = displayOptions.value.map((o) => (o.count / total) * 100)
  const floored = exact.map(Math.floor)
  const remainders = exact.map((v, i) => ({ i, r: v - (floored[i] ?? 0) }))
  const diff = 100 - floored.reduce((a, b) => a + b, 0)

  const result = [...floored]
  remainders
    .sort((a, b) => b.r - a.r)
    .slice(0, diff)
    .forEach(({ i }) => {
      result[i] = (result[i] ?? 0) + 1
    })

  return result
})
</script>

<template>
  <div class="space-y-3">
    <p class="sr-only" aria-live="polite">
      {{ liveAnnouncement }}
    </p>

    <TransitionGroup name="list" tag="div" class="space-y-2">
      <div v-for="(option, index) in displayOptions" :key="option.id" class="group">
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="text-left text-base font-medium"
              :class="{ 'text-muted': option.canWin === false }"
            >
              {{ option.label }}
            </span>
            <UIcon
              v-if="isWinner(option.id)"
              name="i-tabler-trophy"
              class="size-5 shrink-0 text-yellow-500"
              :aria-label="t('accessibility.winner')"
            />
            <UIcon
              v-else-if="option.thresholdReached && option.canWin !== false"
              name="i-tabler-check"
              class="size-5 shrink-0 text-green-500"
              :aria-label="t('accessibility.thresholdReached')"
            />
          </div>
          <span class="shrink-0 font-mono text-base font-bold tabular-nums">
            {{ formatNumber(option.count) }} · {{ roundedPcts[index] }}%
          </span>
        </div>
        <VoteBar
          :count="option.count"
          :total="totalVotes"
          :color="getOptionDisplayColor(option.color, index)"
          :threshold-reached="option.thresholdReached && option.canWin !== false"
          :is-winner="isWinner(option.id)"
          :tall="true"
        />
      </div>
    </TransitionGroup>

    <div class="border-default flex items-center justify-between border-t pt-3">
      <span class="text-muted text-base font-medium">{{ t('votes.total') }}</span>
      <span class="font-mono text-xl font-bold tabular-nums">{{ formatNumber(totalVotes) }}</span>
    </div>

    <p v-if="minimumVotes" class="text-muted text-sm">
      {{ t('votes.minimumVotesInfo', { count: minimumVotes }) }}
    </p>

    <!-- Screen-reader accessible data table -->
    <div class="sr-only">
      <table :aria-label="t('accessibility.voteChart')">
        <thead>
          <tr>
            <th scope="col">{{ t('votes.option') }}</th>
            <th scope="col">{{ t('votes.count') }}</th>
            <th scope="col">{{ t('votes.percentage') }}</th>
            <th scope="col">{{ t('accessibility.doesNotCount') }}</th>
            <th scope="col">{{ t('accessibility.thresholdReached') }}</th>
            <th scope="col">{{ t('accessibility.winner') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(option, index) in displayOptions" :key="option.id">
            <td>{{ option.label }}</td>
            <td>{{ formatNumber(option.count) }}</td>
            <td>{{ roundedPcts[index] }}%</td>
            <td>{{ option.canWin === false ? t('votes.cannotWinLabel') : '' }}</td>
            <td>
              {{
                option.thresholdReached && option.canWin !== false
                  ? t('accessibility.thresholdReached')
                  : ''
              }}
            </td>
            <td>{{ isWinner(option.id) ? t('accessibility.winner') : '' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>{{ t('votes.total') }}</td>
            <td>{{ formatNumber(totalVotes) }}</td>
            <td>{{ totalVotes > 0 ? '100%' : '0%' }}</td>
            <td />
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
