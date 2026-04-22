import { eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { createVoteSchema } from '#validation/votes'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, message: 'ID de evento requerido' })

  const [parentEvent] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!parentEvent) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  const body = await readBody(event)
  const data = createVoteSchema.parse(body)

  const [orderRow] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${votes.order}) + 1, 0)` })
    .from(votes)
    .where(eq(votes.eventId, eventId))

  const [created] = await db
    .insert(votes)
    .values({
      eventId,
      name: data.name,
      visible: data.visible,
      order: orderRow?.nextOrder ?? 0,
    })
    .returning()

  return { data: created }
})
