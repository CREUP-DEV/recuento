import type { MaybeRef, Ref } from 'vue'
import type { SSEEvent, VoteCountUpdateEvent } from '~~/shared/types/sseEvents'

export interface VoteStreamVoteResponse {
  data: {
    options: VoteStreamOption[]
  }
}

export type VoteStreamOption = VoteCountUpdateEvent['options'][number]

export function useVoteStream(voteId?: MaybeRef<string | null>) {
  const options = ref<VoteStreamOption[]>([])
  const isConnected = ref(false)
  const lastEvent = ref<SSEEvent | null>(null)
  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000

  async function refetchVoteData() {
    const voteIdValue = unref(voteId)
    if (!voteIdValue) return
    try {
      const res = await $fetch<VoteStreamVoteResponse>(`/api/votes/${voteIdValue}`)
      options.value = res.data.options
    } catch {
      // Best-effort — SSE will sync on next event
    }
  }

  function connect() {
    if (import.meta.server) return

    const voteIdValue = unref(voteId)
    const url = voteIdValue
      ? `/api/sse/votes?voteId=${encodeURIComponent(voteIdValue)}`
      : '/api/sse/votes'

    eventSource = new EventSource(url)

    eventSource.addEventListener('connected', () => {
      isConnected.value = true
      reconnectDelay = 1000
      // Reconnected after a gap — fetch fresh counts so stale data isn't shown
      refetchVoteData()
    })

    eventSource.addEventListener('vote-count-update', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!data || typeof data !== 'object' || !Array.isArray(data.options)) return
        lastEvent.value = data as SSEEvent
        options.value = data.options
      } catch {
        // Malformed event — ignore
      }
    })

    eventSource.addEventListener('vote-status-change', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return
        lastEvent.value = data as SSEEvent
      } catch {
        // Malformed event — ignore
      }
    })

    eventSource.onerror = () => {
      isConnected.value = false
      eventSource?.close()
      eventSource = null

      // Jitter ±25% on the delay to spread reconnect attempts after server restart
      const jitter = 0.75 + Math.random() * 0.5
      reconnectTimeout = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
        connect()
      }, reconnectDelay * jitter)
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    isConnected.value = false
  }

  onMounted(() => connect())
  onBeforeUnmount(() => disconnect())

  return {
    options: options as Ref<VoteStreamOption[]>,
    isConnected,
    lastEvent,
    reconnect: () => {
      disconnect()
      connect()
    },
  }
}
