export type SSENamedEvent = 'vote-count-update' | 'vote-status-change' | 'vote-closed'

export type SSEEventHandler = (type: SSENamedEvent | 'connected', data: unknown) => void

export interface UseSSEConnectionOptions {
  url: string | (() => string)
  onEvent: SSEEventHandler
  onConnectionStateChange?: (connected: boolean) => void
}

const NAMED_EVENTS: SSENamedEvent[] = ['vote-count-update', 'vote-status-change', 'vote-closed']

export function makeSSEClient(opts: UseSSEConnectionOptions) {
  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000
  let stopped = false

  function connect() {
    if (stopped) return
    const url = typeof opts.url === 'function' ? opts.url() : opts.url
    eventSource = new EventSource(url)

    eventSource.addEventListener('connected', (e) => {
      reconnectDelay = 1000
      opts.onConnectionStateChange?.(true)
      try {
        opts.onEvent('connected', JSON.parse((e as MessageEvent).data))
      } catch {
        /* ignore */
      }
    })

    for (const name of NAMED_EVENTS) {
      eventSource.addEventListener(name, (e) => {
        try {
          opts.onEvent(name, JSON.parse((e as MessageEvent).data))
        } catch {
          /* ignore */
        }
      })
    }

    eventSource.onerror = () => {
      opts.onConnectionStateChange?.(false)
      eventSource?.close()
      eventSource = null
      if (stopped) return
      const jitter = 0.75 + Math.random() * 0.5
      reconnectTimeout = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
        connect()
      }, reconnectDelay * jitter)
    }
  }

  function disconnect() {
    stopped = true
    opts.onConnectionStateChange?.(false)
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    eventSource?.close()
    eventSource = null
  }

  function reconnect() {
    stopped = false
    reconnectDelay = 1000
    opts.onConnectionStateChange?.(false)
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    eventSource?.close()
    eventSource = null
    connect()
  }

  return { connect, disconnect, reconnect }
}

/**
 * Composable wrapper around makeSSEClient that auto-connects on mount
 * and disconnects on unmount. Use this for per-instance SSE connections.
 */
export function useSSEConnection(opts: UseSSEConnectionOptions) {
  const isConnected = ref(false)

  const client = makeSSEClient({
    url: opts.url,
    onConnectionStateChange(connected) {
      isConnected.value = connected
      opts.onConnectionStateChange?.(connected)
    },
    onEvent(type, data) {
      opts.onEvent(type, data)
    },
  })

  // Patch disconnect to also track connected state
  const originalDisconnect = client.disconnect
  function disconnect() {
    originalDisconnect()
    isConnected.value = false
  }

  if (import.meta.server) {
    return { isConnected, disconnect, reconnect: client.reconnect }
  }

  onMounted(() => client.connect())
  onBeforeUnmount(() => disconnect())

  return { isConnected, disconnect, reconnect: client.reconnect }
}
