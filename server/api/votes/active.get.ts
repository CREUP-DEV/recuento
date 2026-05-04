import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { votes, events, voteOptions } from '../../db/schema'
import { toPublicEvent, toPublicVote } from '../../utils/publicDtos'

export default defineEventHandler(async () => {
  const [activeVoteRow] = await db
    .select({ id: votes.id })
    .from(votes)
    .innerJoin(
      events,
      and(eq(events.id, votes.eventId), eq(events.visible, true), isNull(events.deletedAt))
    )
    .where(and(eq(votes.open, true), eq(votes.visible, true), isNull(votes.deletedAt)))
    .orderBy(desc(votes.startedAt), desc(votes.updatedAt), asc(votes.id))
    .limit(1)

  if (!activeVoteRow) {
    return { data: null }
  }

  const activeVote = await db.query.votes.findFirst({
    where: eq(votes.id, activeVoteRow.id),
    with: {
      event: true,
      options: {
        where: isNull(voteOptions.deletedAt),
        orderBy: (option, operators) => [operators.asc(option.order)],
      },
    },
  })

  return {
    data:
      activeVote && activeVote.event
        ? {
            ...toPublicVote(activeVote, activeVote.options),
            event: toPublicEvent(activeVote.event),
          }
        : null,
  }
})
