import { and, eq, ne } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireOptionInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { updateOptionSchema } from '#validation/options'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const body = await readBody(event)
  const data = updateOptionSchema.parse(body)
  const vote = await requireVoteInAdminScope(eventId, voteId)
  await requireOptionInAdminScope(eventId, voteId, optionId)

  const isStructuralChange =
    data.label !== undefined || data.color !== undefined || data.shortcut !== undefined

  if (vote.open && isStructuralChange) {
    throw createError({
      statusCode: 409,
      message: 'No se pueden cambiar las opciones mientras la votación está abierta.',
    })
  }

  if (data.shortcut) {
    const [existingShortcut] = await db
      .select({ id: voteOptions.id })
      .from(voteOptions)
      .where(
        and(
          eq(voteOptions.voteId, voteId),
          eq(voteOptions.shortcut, data.shortcut),
          ne(voteOptions.id, optionId)
        )
      )
      .limit(1)

    if (existingShortcut) {
      throw createError({
        statusCode: 409,
        message: 'El atajo ya está en uso en esta votación.',
      })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.label !== undefined) updateData.label = data.label
  if (data.color !== undefined) updateData.color = data.color
  if (data.shortcut !== undefined) updateData.shortcut = data.shortcut
  if (data.count !== undefined) updateData.count = data.count

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No se han proporcionado campos para actualizar',
    })
  }

  const [updated] = await db
    .update(voteOptions)
    .set(updateData)
    .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Opción no encontrada' })
  }

  if (data.count !== undefined) {
    await emitVoteCountUpdate(voteId)
  }

  return { data: updated }
})
