import { and, eq, exists, isNull, sql } from 'drizzle-orm'
import { db } from '#db'
import { events, votes, voteOptions } from '#db/schema'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { isDuplicateRequest } from '#server-utils/requestDeduplication'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const nonce = getRequestHeader(event, 'x-request-id')
  if (nonce && (await isDuplicateRequest(voteId, nonce))) {
    return { data: null, deduplicated: true }
  }

  const [updated] = await db
    .update(voteOptions)
    .set({ count: sql`GREATEST(${voteOptions.count} - 1, 0)` })
    .where(
      and(
        eq(voteOptions.id, optionId),
        eq(voteOptions.voteId, voteId),
        isNull(voteOptions.deletedAt),
        exists(
          db
            .select({ id: votes.id })
            .from(votes)
            .innerJoin(events, eq(events.id, votes.eventId))
            .where(
              and(
                eq(votes.id, voteId),
                eq(votes.eventId, eventId),
                eq(votes.open, true),
                isNull(votes.deletedAt),
                isNull(events.deletedAt)
              )
            )
        )
      )
    )
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteNotOpenOrOptionMissing'),
    })
  }

  emitVoteCountUpdate(voteId)

  return { data: updated }
})
