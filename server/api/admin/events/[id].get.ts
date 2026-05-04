import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const result = await db.query.events.findFirst({
    where: and(or(eq(events.id, id), eq(events.slug, id)), isNull(events.deletedAt)),
    with: {
      votes: {
        where: (v, { isNull }) => isNull(v.deletedAt),
        with: {
          options: {
            where: (o, { isNull }) => isNull(o.deletedAt),
            orderBy: (o, { asc }) => [asc(o.order)],
          },
        },
        orderBy: (v, { asc }) => [asc(v.order)],
      },
    },
  })

  if (!result) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })
  }

  return { data: result }
})
