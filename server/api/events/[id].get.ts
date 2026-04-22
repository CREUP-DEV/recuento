import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { events, votes } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.visible, true)))
    .limit(1)

  if (!ev) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  const eventVotes = await db.query.votes.findMany({
    where: and(eq(votes.eventId, id), eq(votes.visible, true)),
    with: { options: { orderBy: (o, { asc }) => [asc(o.order)] } },
    orderBy: (v, { asc }) => [asc(v.order)],
  })

  return {
    data: {
      ...ev,
      votes: eventVotes,
    },
  }
})
