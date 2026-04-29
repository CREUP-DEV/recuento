import { EventEmitter } from 'node:events'
import type {
  VoteCountUpdateEvent,
  VoteStatusChangeEvent,
  VoteClosedEvent,
} from '~~/shared/types/sseEvents'

export interface SerializedSSEEvent {
  type: string
  voteId: string
  json: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

// ─── Per-IP connection tracking ──────────────────────────────────────���────────

const MAX_CONNECTIONS_PER_IP = 10
const connectionsByIp = new Map<string, number>()

export function trackSSEConnection(ip: string): boolean {
  const current = connectionsByIp.get(ip) ?? 0
  if (current >= MAX_CONNECTIONS_PER_IP) return false
  connectionsByIp.set(ip, current + 1)
  return true
}

export function releaseSSEConnection(ip: string): void {
  const current = connectionsByIp.get(ip) ?? 0
  if (current <= 1) connectionsByIp.delete(ip)
  else connectionsByIp.set(ip, current - 1)
}

export function emitVoteUpdate(data: VoteCountUpdateEvent) {
  emitter.emit('sse', { type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function emitVoteStatusChange(data: VoteStatusChangeEvent) {
  emitter.emit('sse', { type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function emitVoteClosed(data: VoteClosedEvent) {
  emitter.emit('sse', { type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function onSSEEvent(handler: (data: SerializedSSEEvent) => void) {
  emitter.on('sse', handler)
  return () => {
    emitter.off('sse', handler)
  }
}

export function getSSESubscriberCount() {
  return emitter.listenerCount('sse')
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
