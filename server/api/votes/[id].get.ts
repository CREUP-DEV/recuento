import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../../db'
import type { events } from '../../db/schema'
import { voteOptions, votes } from '../../db/schema'
import { toPublicEvent, toPublicVote } from '../../utils/publicDtos'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const vote = await db.query.votes.findFirst({
    where: and(
      or(eq(votes.id, id), eq(votes.slug, id)),
      eq(votes.visible, true),
      isNull(votes.deletedAt)
    ),
    with: {
      event: true,
      options: {
        where: isNull(voteOptions.deletedAt),
        orderBy: (o, { asc }) => [asc(o.order)],
      },
    },
  })

  if (!vote || !vote.event?.visible || vote.event.deletedAt) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'voteNotFound') })
  }

  return {
    data: {
      ...toPublicVote(vote, vote.options),
      event: toPublicEvent(vote.event as typeof events.$inferSelect),
    },
  }
})
