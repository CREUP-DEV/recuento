import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { votes } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange } from '#server-utils/sseManager'
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

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.visible !== undefined) updateData.visible = data.visible
  if (data.minimumVotes !== undefined) updateData.minimumVotes = data.minimumVotes
  if (data.maxWinners !== undefined) updateData.maxWinners = data.maxWinners
  if (data.confettiEnabled !== undefined) updateData.confettiEnabled = data.confettiEnabled

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
    })
  }

  return { data: updated }
})
