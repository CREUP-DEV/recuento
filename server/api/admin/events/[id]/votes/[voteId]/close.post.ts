import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '#db'
import { votes, voteOptions } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange, emitVoteClosed } from '#server-utils/sseManager'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (!vote.open) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'voteAlreadyClosed') })
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(votes)
      .set({ open: false, endedAt: sql`now()` })
      .where(and(eq(votes.id, voteId), eq(votes.open, true)))
      .returning()

    if (!updated)
      throw createError({
        statusCode: 409,
        message: getApiErrorMessage(event, 'voteAlreadyClosed'),
      })

    const options = await tx
      .select()
      .from(voteOptions)
      .where(and(eq(voteOptions.voteId, voteId), isNull(voteOptions.deletedAt)))
      .orderBy(asc(voteOptions.order))

    const { winnerIds } = calculateWinners(
      options.map((o) => ({ id: o.id, count: o.count, canWin: o.canWin })),
      updated.minimumVotes ?? null,
      updated.maxWinners ?? null
    )

    return { updated, winnerIds }
  })

  emitVoteStatusChange({
    type: 'vote-status-change',
    voteId: result.updated.id,
    eventId: result.updated.eventId,
    open: false,
    visible: true,
    startedAt: result.updated.startedAt?.toISOString() ?? null,
    endedAt: result.updated.endedAt?.toISOString() ?? null,
  })

  emitVoteClosed({
    type: 'vote-closed',
    voteId: result.updated.id,
    eventId: result.updated.eventId,
    winnerIds: [...result.winnerIds],
    minimumVotes: result.updated.minimumVotes ?? null,
    maxWinners: result.updated.maxWinners ?? null,
    confettiEnabled: result.updated.confettiEnabled,
  })

  return { data: { ...result.updated, winnerIds: [...result.winnerIds] } }
})
