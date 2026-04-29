import type { SSEEvent } from '~~/shared/types/sseEvents'

export interface ActiveVoteData {
  id: string
  name: string
  eventId: string
  minimumVotes: number | null
  maxWinners: number | null
  confettiEnabled: boolean
  event?: {
    id: string
    name: string
  }
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
    canWin: boolean
  }>
}

// Module-level singleton for the SSE connection.
// Only accessed inside onMounted (client-only), so safe in SSR environments.
let _sseClient: ReturnType<typeof makeSSEClient> | null = null
let _subscribers = 0

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _sseClient?.disconnect()
    _sseClient = null
    _subscribers = 0
  })
}

export function useActiveVote() {
  // useState is SSR-safe: scoped per request on server, shared on client
  const activeVote = useState<ActiveVoteData | null>('active-vote', () => null)
  const isLoading = useState<boolean>('active-vote-loading', () => true)
  const winnerIds = useState<string[]>('active-vote-winner-ids', () => [])

  async function refresh() {
    try {
      const { data } = await $fetch<{ data: ActiveVoteData | null }>('/api/votes/active')
      activeVote.value = data
    } catch {
      activeVote.value = null
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    _subscribers++
    if (_subscribers === 1) {
      refresh()

      _sseClient = makeSSEClient({
        url: '/api/sse/votes',
        onEvent(type, data) {
          if (!data || typeof data !== 'object') return
          const d = data as SSEEvent & Record<string, unknown>

          if (type === 'connected') {
            winnerIds.value = []
            refresh()
          } else if (type === 'vote-count-update') {
            if (!activeVote.value || d.voteId !== activeVote.value.id) return
            if (!Array.isArray(d.options)) return
            activeVote.value = {
              ...activeVote.value,
              minimumVotes: (d.minimumVotes as number | null) ?? null,
              maxWinners: (d.maxWinners as number | null) ?? null,
              confettiEnabled: (d.confettiEnabled as boolean) ?? true,
              options: d.options as ActiveVoteData['options'],
            }
          } else if (type === 'vote-status-change') {
            if ((d.open as boolean) === true) winnerIds.value = []
            refresh()
          } else if (type === 'vote-closed') {
            if (!activeVote.value || d.voteId !== activeVote.value.id) return
            winnerIds.value = Array.isArray(d.winnerIds) ? (d.winnerIds as string[]) : []
          }
        },
      })

      _sseClient.connect()
    }
  })

  onBeforeUnmount(() => {
    _subscribers--
    if (_subscribers === 0) {
      _sseClient?.disconnect()
      _sseClient = null
    }
  })

  return { activeVote, isLoading, refresh, winnerIds }
}
