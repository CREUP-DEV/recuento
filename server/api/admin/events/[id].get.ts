import { eq } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

  const result = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      votes: {
        with: { options: { orderBy: (o, { asc }) => [asc(o.order)] } },
        orderBy: (v, { asc }) => [asc(v.order)],
      },
    },
  })

  if (!result) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  return { data: result }
})
