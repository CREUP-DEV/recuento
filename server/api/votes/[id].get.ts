import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { votes } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

  const vote = await db.query.votes.findFirst({
    where: and(eq(votes.id, id), eq(votes.visible, true)),
    with: {
      event: true,
      options: { orderBy: (o, { asc }) => [asc(o.order)] },
    },
  })

  if (!vote || !vote.event?.visible) {
    throw createError({ statusCode: 404, message: 'Votación no encontrada' })
  }

  return { data: vote }
})
