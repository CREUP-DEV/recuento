import { and, eq, exists, sql } from 'drizzle-orm'
import { db } from '#db'
import { events, votes, voteOptions } from '#db/schema'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const [updated] = await db
    .update(voteOptions)
    .set({ count: sql`${voteOptions.count} + 1` })
    .where(
      and(
        eq(voteOptions.id, optionId),
        eq(voteOptions.voteId, voteId),
        exists(
          db
            .select({ id: votes.id })
            .from(votes)
            .innerJoin(events, eq(events.id, votes.eventId))
            .where(and(eq(votes.id, voteId), eq(votes.eventId, eventId), eq(votes.open, true)))
        )
      )
    )
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 409,
      message: 'La votación no está abierta o la opción no existe',
    })
  }

  emitVoteCountUpdate(voteId)

  return { data: updated }
})
