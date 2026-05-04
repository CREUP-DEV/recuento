import type { MaybeRef, Ref } from 'vue'
import type { SSEEvent, VoteCountUpdateEvent } from '~~/shared/types/sseEvents'

export interface VoteStreamVoteResponse {
  data: {
    minimumVotes: number | null
    maxWinners: number | null
    confettiEnabled: boolean
    options: VoteStreamOption[]
  }
}

export type VoteStreamOption = VoteCountUpdateEvent['options'][number]

export function useVoteStream(voteId?: MaybeRef<string | null>, eventId?: MaybeRef<string | null>) {
  const options = ref<VoteStreamOption[]>([])
  const minimumVotes = ref<number | null>(null)
  const maxWinners = ref<number | null>(null)
  const confettiEnabled = ref(true)
  const winnerIds = ref<string[]>([])
  const lastEvent = ref<SSEEvent | null>(null)
  const isHidden = ref(false)

  async function refetchVoteData() {
    const voteIdValue = unref(voteId)
    const eventIdValue = unref(eventId)
    if (!voteIdValue || !eventIdValue) return
    try {
      const res = await $fetch<VoteStreamVoteResponse>(
        `/api/events/${eventIdValue}/votes/${voteIdValue}`
      )
      options.value = res.data.options
      minimumVotes.value = res.data.minimumVotes ?? null
      maxWinners.value = res.data.maxWinners ?? null
      confettiEnabled.value = res.data.confettiEnabled
    } catch {
      // Best-effort — SSE will sync on next event
    }
  }

  const { isConnected, reconnect } = useSSEConnection({
    url: () => {
      const voteIdValue = unref(voteId)
      return voteIdValue
        ? `/api/sse/votes?voteId=${encodeURIComponent(voteIdValue)}`
        : '/api/sse/votes'
    },
    onEvent(type, data) {
      if (type === 'connected') {
        winnerIds.value = []
        refetchVoteData()
        return
      }

      if (!data || typeof data !== 'object') return

      if (type === 'vote-count-update') {
        const d = data as VoteCountUpdateEvent
        if (!Array.isArray(d.options)) return
        lastEvent.value = d
        options.value = d.options
        minimumVotes.value = d.minimumVotes ?? null
        maxWinners.value = d.maxWinners ?? null
        confettiEnabled.value = d.confettiEnabled ?? true
      } else if (type === 'vote-status-change') {
        const d = data as SSEEvent & { open?: boolean; visible?: boolean }
        if (d.open === true) winnerIds.value = []
        if (d.visible === false) isHidden.value = true
        lastEvent.value = data as SSEEvent
      } else if (type === 'vote-closed') {
        const d = data as SSEEvent & { winnerIds?: unknown }
        lastEvent.value = data as SSEEvent
        winnerIds.value = Array.isArray(d.winnerIds) ? (d.winnerIds as string[]) : []
      } else if (type === 'content-changed') {
        lastEvent.value = data as SSEEvent
        refetchVoteData()
      }
    },
  })

  return {
    options: options as Ref<VoteStreamOption[]>,
    minimumVotes,
    maxWinners,
    confettiEnabled,
    winnerIds,
    isConnected,
    isHidden,
    lastEvent,
    reconnect,
  }
}
