import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '#db'
import { votes, voteOptions } from '#db/schema'
import { requireEventInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange, emitVoteUpdate } from '#server-utils/sseManager'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const parentEvent = await requireEventInAdminScope(eventId)
  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (vote.open) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'voteAlreadyOpen') })
  }
  if (!parentEvent.visible) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteOpenBlockedByHiddenEvent'),
    })
  }
  if (!vote.visible) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteOpenBlockedByHiddenVote'),
    })
  }

  const optionRows = await db
    .select({ canWin: voteOptions.canWin })
    .from(voteOptions)
    .where(and(eq(voteOptions.voteId, voteId), isNull(voteOptions.deletedAt)))

  if (optionRows.length === 0) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteMissingOptions'),
    })
  }

  if (!optionRows.some((o) => o.canWin)) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteNoWinningOption'),
    })
  }

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1000001)`)

    const [alreadyOpen] = await tx
      .select({ id: votes.id, eventId: votes.eventId, name: votes.name })
      .from(votes)
      .where(and(eq(votes.open, true), isNull(votes.deletedAt), ne(votes.id, voteId)))
      .limit(1)

    if (alreadyOpen) {
      throw createError({
        statusCode: 409,
        message: getApiErrorMessage(event, 'voteOpenConflict'),
        data: {
          openVoteId: alreadyOpen.id,
          openEventId: alreadyOpen.eventId,
          openVoteName: alreadyOpen.name,
        },
      })
    }

    const [result] = await tx
      .update(votes)
      .set({ open: true, startedAt: sql`now()`, endedAt: null })
      .where(eq(votes.id, voteId))
      .returning()

    if (!result)
      throw createError({ statusCode: 500, message: getApiErrorMessage(event, 'voteOpenFailed') })

    return result
  })

  const options = await db
    .select()
    .from(voteOptions)
    .where(and(eq(voteOptions.voteId, voteId), isNull(voteOptions.deletedAt)))
    .orderBy(asc(voteOptions.order))

  emitVoteStatusChange({
    type: 'vote-status-change',
    voteId: updated.id,
    eventId: updated.eventId,
    open: true,
    visible: true,
    startedAt: updated.startedAt?.toISOString() ?? null,
    endedAt: null,
  })

  emitVoteUpdate({
    type: 'vote-count-update',
    voteId: updated.id,
    eventId: updated.eventId,
    minimumVotes: updated.minimumVotes ?? null,
    maxWinners: updated.maxWinners ?? null,
    confettiEnabled: updated.confettiEnabled,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      color: o.color,
      count: o.count,
      canWin: o.canWin,
      thresholdReached: false,
    })),
  })

  return { data: updated }
})
