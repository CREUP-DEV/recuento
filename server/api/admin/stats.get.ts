import { and, count, eq } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'

export default defineEventHandler(async () => {
  const [[totalEvents], [activeEvents], [openVotes]] = await Promise.all([
    db.select({ value: count() }).from(events),
    db.select({ value: count() }).from(events).where(eq(events.visible, true)),
    db
      .select({ value: count() })
      .from(votes)
      .where(and(eq(votes.open, true))),
  ])

  return {
    data: {
      totalEvents: totalEvents?.value ?? 0,
      activeEvents: activeEvents?.value ?? 0,
      openVotes: openVotes?.value ?? 0,
    },
  }
})
