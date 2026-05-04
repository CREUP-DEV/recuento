import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../../db'
import { events, votes, voteOptions } from '../../db/schema'
import { toPublicEvent, toPublicVote } from '../../utils/publicDtos'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const [ev] = await db
    .select()
    .from(events)
    .where(
      and(
        or(eq(events.id, id), eq(events.slug, id)),
        eq(events.visible, true),
        isNull(events.deletedAt)
      )
    )
    .limit(1)

  if (!ev) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })
  }

  const eventVotes = await db.query.votes.findMany({
    where: and(eq(votes.eventId, ev.id), eq(votes.visible, true), isNull(votes.deletedAt)),
    with: {
      options: {
        where: isNull(voteOptions.deletedAt),
        orderBy: (o, { asc }) => [asc(o.order)],
      },
    },
    orderBy: (v, { asc }) => [asc(v.order)],
  })

  return {
    data: {
      ...toPublicEvent(ev),
      votes: eventVotes.map((vote) => toPublicVote(vote, vote.options)),
    },
  }
})
