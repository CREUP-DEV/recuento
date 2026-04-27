export interface ActiveVoteData {
  id: string
  name: string
  eventId: string
  event?: {
    id: string
    name: string
  }
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
  }>
}

// Module-level singletons for the SSE connection.
// Only accessed inside onMounted (client-only), so safe in SSR environments.
let _sse: EventSource | null = null
let _subscribers = 0
let _reconnectDelay = 1_000

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _sse?.close()
    _sse = null
    _subscribers = 0
    _reconnectDelay = 1_000
  })
}

export function useActiveVote() {
  // useState is SSR-safe: scoped per request on server, shared on client
  const activeVote = useState<ActiveVoteData | null>('active-vote', () => null)
  const isLoading = useState<boolean>('active-vote-loading', () => true)

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

  function connectSSE() {
    if (_sse) return
    _sse = new EventSource('/api/sse/votes')

    _sse.addEventListener('connected', () => {
      _reconnectDelay = 1_000
    })

    _sse.addEventListener('vote-status-change', () => refresh())

    _sse.onerror = () => {
      _sse?.close()
      _sse = null
      if (_subscribers > 0) {
        const jitter = 0.75 + Math.random() * 0.5
        setTimeout(() => {
          _reconnectDelay = Math.min(_reconnectDelay * 2, 30_000)
          if (_subscribers > 0) connectSSE()
        }, _reconnectDelay * jitter)
      }
    }
  }

  onMounted(() => {
    _subscribers++
    if (_subscribers === 1) {
      refresh()
      connectSSE()
    }
  })

  onBeforeUnmount(() => {
    _subscribers--
    if (_subscribers === 0) {
      _sse?.close()
      _sse = null
    }
  })

  return { activeVote, isLoading, refresh }
}
