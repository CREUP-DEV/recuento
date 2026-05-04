import { z } from 'zod'
import { and, eq, exists, isNull } from 'drizzle-orm'
import { db } from '#db'
import { events, votes, voteOptions } from '#db/schema'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'

const setCountSchema = z.object({
  count: z.number().int().min(0).max(999_999),
})

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const body = await readBody(event)
  const data = setCountSchema.parse(body)

  const [updated] = await db
    .update(voteOptions)
    .set({ count: data.count })
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

  await emitVoteCountUpdate(voteId)

  return { data: updated }
})
