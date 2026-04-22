import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { db } from '#db'
import { votes, voteOptions } from '#db/schema'
import { requireEventInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange, emitVoteUpdate } from '#server-utils/sseManager'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const parentEvent = await requireEventInAdminScope(eventId)
  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (vote.open) {
    throw createError({ statusCode: 400, message: 'La votación ya está abierta' })
  }
  if (!parentEvent.visible) {
    throw createError({
      statusCode: 409,
      message: 'No se puede abrir una votación de un evento oculto.',
    })
  }
  if (!vote.visible) {
    throw createError({
      statusCode: 409,
      message: 'No se puede abrir una votación oculta.',
    })
  }

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('global-open-vote')::bigint)`)

    const [alreadyOpen] = await tx
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.open, true), ne(votes.id, voteId)))
      .limit(1)

    if (alreadyOpen) {
      throw createError({
        statusCode: 409,
        message: 'Ya hay una votación abierta. Ciérrala antes de abrir otra.',
      })
    }

    const [result] = await tx
      .update(votes)
      .set({ open: true, startedAt: sql`now()`, endedAt: null })
      .where(eq(votes.id, voteId))
      .returning()

    if (!result) throw createError({ statusCode: 500, message: 'Error al abrir la votación' })

    return result
  })

  const options = await db
    .select()
    .from(voteOptions)
    .where(eq(voteOptions.voteId, voteId))
    .orderBy(asc(voteOptions.order))

  emitVoteStatusChange({
    type: 'vote-status-change',
    voteId: updated.id,
    eventId: updated.eventId,
    open: true,
    startedAt: updated.startedAt?.toISOString() ?? null,
    endedAt: null,
  })

  emitVoteUpdate({
    type: 'vote-count-update',
    voteId: updated.id,
    eventId: updated.eventId,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      color: o.color,
      count: o.count,
    })),
  })

  return { data: updated }
})
