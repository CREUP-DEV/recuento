import { eq, asc } from 'drizzle-orm'
import { db } from '../../db'
import { events } from '../../db/schema'

export default defineEventHandler(async () => {
  const visibleEvents = await db
    .select()
    .from(events)
    .where(eq(events.visible, true))
    .orderBy(asc(events.order), asc(events.startDate))

  return { data: visibleEvents }
})
