import type { SSEEvent } from '~~/shared/types/sseEvents'
import {
  onSSEEvent,
  onSSEShutdown,
  trackSSEConnection,
  releaseSSEConnection,
} from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const ip =
    (event.node.req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    event.node.req.socket.remoteAddress ??
    'unknown'

  if (!trackSSEConnection(ip)) {
    throw createError({ statusCode: 429, message: 'Too many SSE connections from this address' })
  }

  const query = getQuery(event)
  const filterVoteId = typeof query.voteId === 'string' ? query.voteId : null

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const writer = event.node.res

  writer.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)

  const heartbeat = setInterval(() => {
    try {
      writer.write(`: heartbeat ${Date.now()}\n\n`)
    } catch {
      clearInterval(heartbeat)
    }
  }, 30_000)

  const handler = (data: SSEEvent) => {
    if (filterVoteId && data.voteId !== filterVoteId) return
    try {
      writer.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Client disconnected
    }
  }

  const unsubscribeSSE = onSSEEvent(handler)

  await new Promise<void>((resolve) => {
    const unsubscribeShutdown = onSSEShutdown(() => {
      clearInterval(heartbeat)
      unsubscribeSSE()
      releaseSSEConnection(ip)
      try {
        writer.end()
      } catch {
        // Already closed
      }
      resolve()
    })

    event.node.req.once('close', () => {
      clearInterval(heartbeat)
      unsubscribeSSE()
      releaseSSEConnection(ip)
      unsubscribeShutdown()
      resolve()
    })
  })
})
