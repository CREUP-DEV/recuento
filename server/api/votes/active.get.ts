import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { votes, events } from '../../db/schema'

export default defineEventHandler(async () => {
  const [activeVoteRow] = await db
    .select({ id: votes.id })
    .from(votes)
    .innerJoin(events, and(eq(events.id, votes.eventId), eq(events.visible, true)))
    .where(and(eq(votes.open, true), eq(votes.visible, true)))
    .orderBy(desc(votes.startedAt), desc(votes.updatedAt), asc(votes.id))
    .limit(1)

  if (!activeVoteRow) {
    return { data: null }
  }

  const activeVote = await db.query.votes.findFirst({
    where: eq(votes.id, activeVoteRow.id),
    with: {
      event: true,
      options: { orderBy: (option, operators) => [operators.asc(option.order)] },
    },
  })

  return { data: activeVote ?? null }
})
