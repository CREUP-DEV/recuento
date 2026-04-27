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
  }>
}>()

const totalVotes = computed(() => props.options.reduce((sum, o) => sum + o.count, 0))

function pct(count: number) {
  return totalVotes.value > 0 ? (count / totalVotes.value) * 100 : 0
}
</script>

<template>
  <div :aria-label="t('accessibility.voteChart')" role="img" class="space-y-3">
    <TransitionGroup name="list" tag="div" class="space-y-2">
      <div v-for="(option, index) in props.options" :key="option.id" class="group">
        <div class="mb-1 flex items-center justify-between gap-3">
          <span class="text-left text-sm font-medium">{{ option.label }}</span>
          <span class="font-mono text-sm font-bold tabular-nums">
            {{ formatNumber(option.count) }} · {{ Math.round(pct(option.count)) }}%
          </span>
        </div>
        <VoteBar
          :count="option.count"
          :total="totalVotes"
          :color="getOptionDisplayColor(option.color, index)"
        />
      </div>
    </TransitionGroup>

    <div class="border-default flex items-center justify-between border-t pt-3">
      <span class="text-muted text-sm font-medium">{{ t('votes.total') }}</span>
      <span class="font-mono text-lg font-bold tabular-nums">{{ formatNumber(totalVotes) }}</span>
    </div>

    <!-- Screen-reader accessible data table -->
    <div class="sr-only">
      <table :aria-label="t('accessibility.voteChart')">
        <thead>
          <tr>
            <th scope="col">{{ t('votes.option') }}</th>
            <th scope="col">{{ t('votes.count') }}</th>
            <th scope="col">{{ t('votes.percentage') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="option in props.options" :key="option.id">
            <td>{{ option.label }}</td>
            <td>{{ formatNumber(option.count) }}</td>
            <td>{{ Math.round(pct(option.count)) }}%</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>{{ t('votes.total') }}</td>
            <td>{{ formatNumber(totalVotes) }}</td>
            <td>100%</td>
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
  transform: translateX(-20px);
}
</style>
