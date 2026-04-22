import { sql } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'
import { createEventSchema } from '#validation/events'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = createEventSchema.parse(body)

  const [orderRow] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${events.order}) + 1, 0)` })
    .from(events)

  const [created] = await db
    .insert(events)
    .values({
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      visible: data.visible,
      order: orderRow?.nextOrder ?? 0,
    })
    .returning()

  return { data: created }
})
