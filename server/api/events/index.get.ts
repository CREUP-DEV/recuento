import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { events } from '../../db/schema'
import { toPublicEvent } from '../../utils/publicDtos'

export default defineEventHandler(async () => {
  const visibleEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.visible, true), isNull(events.deletedAt)))
    .orderBy(asc(events.order), asc(events.startDate))

  return { data: visibleEvents.map(toPublicEvent) }
})
