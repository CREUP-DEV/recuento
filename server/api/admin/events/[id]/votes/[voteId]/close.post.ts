import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { votes, voteOptions } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange, emitVoteClosed } from '#server-utils/sseManager'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (!vote.open) {
    throw createError({ statusCode: 400, message: 'La votación ya está cerrada' })
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(votes)
      .set({ open: false, endedAt: sql`now()` })
      .where(eq(votes.id, voteId))
      .returning()

    if (!updated) throw createError({ statusCode: 500, message: 'Error al cerrar la votación' })

    const options = await tx
      .select()
      .from(voteOptions)
      .where(eq(voteOptions.voteId, voteId))
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
