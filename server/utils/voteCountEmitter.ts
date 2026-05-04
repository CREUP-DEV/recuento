import { and, asc, eq, isNull } from 'drizzle-orm'
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
          minimumVotes: votes.minimumVotes,
          maxWinners: votes.maxWinners,
          confettiEnabled: votes.confettiEnabled,
          optionId: voteOptions.id,
          label: voteOptions.label,
          color: voteOptions.color,
          count: voteOptions.count,
          canWin: voteOptions.canWin,
        })
        .from(votes)
        .innerJoin(events, eq(events.id, votes.eventId))
        .leftJoin(voteOptions, eq(voteOptions.voteId, votes.id))
        .where(
          and(
            eq(votes.id, voteId),
            eq(votes.visible, true),
            isNull(votes.deletedAt),
            eq(events.visible, true),
            isNull(events.deletedAt),
            isNull(voteOptions.deletedAt)
          )
        )
        .orderBy(asc(voteOptions.order))

      if (rows.length === 0) return

      const eventId = rows[0]!.eventId
      const minimumVotes = rows[0]!.minimumVotes ?? null
      const maxWinners = rows[0]!.maxWinners ?? null
      const confettiEnabled = rows[0]!.confettiEnabled
      const options = rows
        .filter((r) => r.optionId !== null)
        .map((r) => ({
          id: r.optionId!,
          label: r.label!,
          color: r.color ?? null,
          count: r.count!,
          canWin: r.canWin ?? true,
          thresholdReached: minimumVotes !== null && (r.canWin ?? true) && r.count! >= minimumVotes,
        }))

      emitVoteUpdate({
        type: 'vote-count-update',
        voteId,
        eventId,
        minimumVotes,
        maxWinners,
        confettiEnabled,
        options,
      })
    }, 50)
  )
}
