import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../../../../db'
import { events, voteOptions, votes } from '../../../../db/schema'
import { toPublicEvent, toPublicVote } from '../../../../utils/publicDtos'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'eventId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const parentEvent = await db.query.events.findFirst({
    where: and(
      or(eq(events.id, eventId), eq(events.slug, eventId)),
      eq(events.visible, true),
      isNull(events.deletedAt)
    ),
  })

  if (!parentEvent) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'voteNotFound') })
  }

  const vote = await db.query.votes.findFirst({
    where: and(
      eq(votes.eventId, parentEvent.id),
      or(eq(votes.id, voteId), eq(votes.slug, voteId)),
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
      event: toPublicEvent(vote.event),
    },
  }
})
