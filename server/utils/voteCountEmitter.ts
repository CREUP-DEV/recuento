import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { votes, voteOptions, events } from '../db/schema'
import { emitVoteUpdate, getSSESubscriberCount } from './sseManager'

const pendingEmits = new Map<string, ReturnType<typeof setTimeout>>()

export function emitVoteCountUpdate(voteId: string): void {
  const existing = pendingEmits.get(voteId)
  if (existing) clearTimeout(existing)

  pendingEmits.set(
    voteId,
    setTimeout(async () => {
      pendingEmits.delete(voteId)

      if (getSSESubscriberCount() === 0) return

      const rows = await db
        .select({
          eventId: votes.eventId,
          optionId: voteOptions.id,
          label: voteOptions.label,
          color: voteOptions.color,
          count: voteOptions.count,
        })
        .from(votes)
        .innerJoin(events, eq(events.id, votes.eventId))
        .leftJoin(voteOptions, eq(voteOptions.voteId, votes.id))
        .where(and(eq(votes.id, voteId), eq(votes.visible, true), eq(events.visible, true)))
        .orderBy(asc(voteOptions.order))

      if (rows.length === 0) return

      const eventId = rows[0]!.eventId
      const options = rows
        .filter((r) => r.optionId !== null)
        .map((r) => ({
          id: r.optionId!,
          label: r.label!,
          color: r.color ?? null,
          count: r.count!,
        }))

      emitVoteUpdate({ type: 'vote-count-update', voteId, eventId, options })
    }, 50)
  )
}
