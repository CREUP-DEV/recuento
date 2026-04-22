import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireOptionInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'

const setCountSchema = z.object({
  count: z.number().int().min(0).max(999_999),
})

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)
  if (!vote.open) {
    throw createError({ statusCode: 409, message: 'La votación no está abierta' })
  }
  await requireOptionInAdminScope(eventId, voteId, optionId)

  const body = await readBody(event)
  const data = setCountSchema.parse(body)

  const [updated] = await db
    .update(voteOptions)
    .set({ count: data.count })
    .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Opción no encontrada' })
  }

  await emitVoteCountUpdate(voteId)

  return { data: updated }
})
