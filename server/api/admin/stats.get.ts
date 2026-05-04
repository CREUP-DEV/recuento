import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'

export default defineEventHandler(async () => {
  const [[totalEvents], [activeEvents], [openVotes]] = await Promise.all([
    db.select({ value: count() }).from(events).where(isNull(events.deletedAt)),
    db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.visible, true), isNull(events.deletedAt))),
    db
      .select({ value: count() })
      .from(votes)
      .where(and(eq(votes.open, true), isNull(votes.deletedAt))),
  ])

  return {
    data: {
      totalEvents: totalEvents?.value ?? 0,
      activeEvents: activeEvents?.value ?? 0,
      openVotes: openVotes?.value ?? 0,
    },
  }
})
