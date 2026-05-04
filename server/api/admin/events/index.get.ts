import { asc, isNull } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'

export default defineEventHandler(async () => {
  const allEvents = await db
    .select()
    .from(events)
    .where(isNull(events.deletedAt))
    .orderBy(asc(events.order), asc(events.startDate))

  const eventIds = allEvents.map((e) => e.id)

  const allVotes =
    eventIds.length > 0
      ? await db.query.votes.findMany({
          where: (v, { and, inArray, isNull }) =>
            and(inArray(v.eventId, eventIds), isNull(v.deletedAt)),
          with: {
            options: {
              where: (o, { isNull }) => isNull(o.deletedAt),
              orderBy: (o, { asc }) => [asc(o.order)],
            },
          },
          orderBy: (v, { asc }) => [asc(v.order)],
        })
      : []

  const votesByEvent = new Map<string, typeof allVotes>()
  for (const vote of allVotes) {
    const list = votesByEvent.get(vote.eventId) ?? []
    list.push(vote)
    votesByEvent.set(vote.eventId, list)
  }

  return {
    data: allEvents.map((e) => ({
      ...e,
      votes: votesByEvent.get(e.id) ?? [],
    })),
  }
})
