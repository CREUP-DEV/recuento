import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { votes } from '#db/schema'
import { pickDefined } from '#server-utils/pickDefined'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { updateVoteSchema } from '#validation/votes'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const currentVote = await requireVoteInAdminScope(eventId, voteId)

  const body = await readBody(event)
  const data = updateVoteSchema.parse(body)

  if (currentVote.open && data.visible === false) {
    throw createError({
      statusCode: 409,
      message: 'No se puede ocultar una votación abierta.',
    })
  }

  if (currentVote.open && (data.minimumVotes !== undefined || data.maxWinners !== undefined)) {
    throw createError({
      statusCode: 409,
      message: 'No se puede modificar la configuración de resultado con la votación abierta.',
    })
  }

  const updateData = pickDefined(data, [
    'name',
    'visible',
    'minimumVotes',
    'maxWinners',
    'confettiEnabled',
  ])

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No se han proporcionado campos para actualizar',
    })
  }

  const [updated] = await db.update(votes).set(updateData).where(eq(votes.id, voteId)).returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Votación no encontrada' })
  }

  if (data.visible !== undefined) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId: updated.id,
      eventId,
      open: updated.open,
      visible: updated.visible,
      startedAt: updated.startedAt?.toISOString() ?? null,
      endedAt: updated.endedAt?.toISOString() ?? null,
    })
  }

  if (
    !updated.open &&
    (data.minimumVotes !== undefined ||
      data.maxWinners !== undefined ||
      data.confettiEnabled !== undefined)
  ) {
    emitVoteCountUpdate(voteId)
  }

  emitContentChanged({ type: 'content-changed', scope: 'vote', eventId, voteId })

  return { data: updated }
})
