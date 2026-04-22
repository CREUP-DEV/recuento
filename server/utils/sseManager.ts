import { EventEmitter } from 'node:events'
import type {
  SSEEvent,
  VoteCountUpdateEvent,
  VoteStatusChangeEvent,
} from '~~/shared/types/sseEvents'

const emitter = new EventEmitter()
emitter.setMaxListeners(500)

export function emitVoteUpdate(data: VoteCountUpdateEvent) {
  emitter.emit('sse', data)
}

export function emitVoteStatusChange(data: VoteStatusChangeEvent) {
  emitter.emit('sse', data)
}

export function onSSEEvent(handler: (data: SSEEvent) => void) {
  emitter.on('sse', handler)
  return () => {
    emitter.off('sse', handler)
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const shutdownHandlers = new Set<() => void>()

export function onSSEShutdown(handler: () => void): () => void {
  shutdownHandlers.add(handler)
  return () => shutdownHandlers.delete(handler)
}

export function broadcastSSEShutdown() {
  for (const handler of shutdownHandlers) handler()
  shutdownHandlers.clear()
}
