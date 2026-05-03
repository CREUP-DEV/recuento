import { and, eq } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { deleteBannerFile } from '#server-utils/adminImageUpload'
import { pickDefined } from '#server-utils/pickDefined'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
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

  const updateData = pickDefined(data, ['name', 'startDate', 'endDate', 'visible', 'banner'])

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No se han proporcionado campos para actualizar',
    })
  }

  const [updated] = await db.update(events).set(updateData).where(eq(events.id, id)).returning()

  if (data.banner === null && existing.banner) {
    await deleteBannerFile(existing.banner)
  }

  if (data.visible !== undefined) {
    const eventVotes = await db
      .select({
        id: votes.id,
        open: votes.open,
        visible: votes.visible,
        startedAt: votes.startedAt,
        endedAt: votes.endedAt,
      })
      .from(votes)
      .where(eq(votes.eventId, id))

    for (const v of eventVotes) {
      emitVoteStatusChange({
        type: 'vote-status-change',
        voteId: v.id,
        eventId: id,
        open: v.open,
        visible: data.visible && v.visible,
        startedAt: v.startedAt?.toISOString() ?? null,
        endedAt: v.endedAt?.toISOString() ?? null,
      })
    }
  }

  emitContentChanged({ type: 'content-changed', scope: 'event', eventId: id })

  return { data: updated }
})
