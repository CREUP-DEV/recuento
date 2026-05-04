import { EventEmitter } from 'node:events'
import type { PoolClient } from 'pg'
import { databasePool } from '../db'
import { logError } from './logger'
import type {
  VoteCountUpdateEvent,
  VoteStatusChangeEvent,
  VoteClosedEvent,
  ContentChangedEvent,
} from '~~/shared/types/sseEvents'

export interface SerializedSSEEvent {
  type: string
  voteId?: string
  json: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)
const NOTIFY_CHANNEL = 'recuento_sse'
const instanceId = `${process.pid}:${Math.random().toString(36).slice(2)}`
let listenerClient: PoolClient | null = null
let listenerStarted = false

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

function emitLocal(data: SerializedSSEEvent) {
  emitter.emit('sse', data)
}

function publishSSEEvent(data: SerializedSSEEvent) {
  emitLocal(data)

  const payload = JSON.stringify({ ...data, origin: instanceId })
  void databasePool
    .query('SELECT pg_notify($1, $2)', [NOTIFY_CHANNEL, payload])
    .catch((error: unknown) => logError('sse.notify', error))
}

export function emitVoteUpdate(data: VoteCountUpdateEvent) {
  publishSSEEvent({ type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function emitVoteStatusChange(data: VoteStatusChangeEvent) {
  publishSSEEvent({ type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function emitVoteClosed(data: VoteClosedEvent) {
  publishSSEEvent({ type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
}

export function emitContentChanged(data: ContentChangedEvent) {
  publishSSEEvent({ type: data.type, voteId: data.voteId, json: JSON.stringify(data) })
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

export async function startSSEPostgresListener() {
  if (listenerStarted) return
  listenerStarted = true

  try {
    listenerClient = await databasePool.connect()
    listenerClient.on('notification', (message) => {
      if (!message.payload) return

      try {
        const payload = JSON.parse(message.payload) as SerializedSSEEvent & { origin?: string }
        if (payload.origin === instanceId) return
        if (!payload.type || !payload.json) return

        emitLocal({
          type: payload.type,
          voteId: payload.voteId,
          json: payload.json,
        })
      } catch (error) {
        logError('sse.notification.parse', error)
      }
    })
    listenerClient.on('error', (error) => logError('sse.listener', error))
    await listenerClient.query(`LISTEN ${NOTIFY_CHANNEL}`)
  } catch (error) {
    listenerStarted = false
    listenerClient?.release()
    listenerClient = null
    logError('sse.listener.start', error)
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
  if (listenerClient) {
    void listenerClient.query(`UNLISTEN ${NOTIFY_CHANNEL}`).finally(() => {
      listenerClient?.release()
      listenerClient = null
      listenerStarted = false
    })
  }
}
