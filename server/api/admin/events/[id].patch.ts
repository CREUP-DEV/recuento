import { and, eq } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { updateEventSchema, validateEventDateRange } from '#validation/events'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

  const [existing] = await db.select().from(events).where(eq(events.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  const body = await readBody(event)
  const data = updateEventSchema.parse(body)

  const startDate = data.startDate ?? existing.startDate
  const endDate = data.endDate ?? existing.endDate

  if (!validateEventDateRange(startDate, endDate)) {
    throw createError({
      statusCode: 400,
      message: 'La fecha de fin debe ser posterior a la de inicio',
    })
  }

  if (data.visible === false) {
    const [openVote] = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.eventId, id), eq(votes.open, true)))
      .limit(1)

    if (openVote) {
      throw createError({
        statusCode: 409,
        message: 'No se puede ocultar un evento con una votación abierta.',
      })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.startDate !== undefined) updateData.startDate = data.startDate
  if (data.endDate !== undefined) updateData.endDate = data.endDate
  if (data.visible !== undefined) updateData.visible = data.visible
  if (data.banner !== undefined) updateData.banner = data.banner

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No se han proporcionado campos para actualizar',
    })
  }

  const [updated] = await db.update(events).set(updateData).where(eq(events.id, id)).returning()

  return { data: updated }
})
