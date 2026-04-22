import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { votes } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'

const updateVoteSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  visible: z.boolean().optional(),
})

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

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.visible !== undefined) updateData.visible = data.visible

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

  return { data: updated }
})
