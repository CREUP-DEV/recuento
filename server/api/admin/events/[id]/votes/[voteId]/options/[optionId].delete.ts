import { and, asc, eq } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireOptionInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { getVoteShortcut } from '~~/shared/constants/voteOptions'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)
  await requireOptionInAdminScope(eventId, voteId, optionId)

  if (vote.open) {
    throw createError({
      statusCode: 409,
      message: 'No se pueden cambiar las opciones mientras la votación está abierta.',
    })
  }

  const deleted = await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(voteOptions)
      .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
      .returning({ id: voteOptions.id })

    const remainingOptions = await tx
      .select({ id: voteOptions.id })
      .from(voteOptions)
      .where(eq(voteOptions.voteId, voteId))
      .orderBy(asc(voteOptions.order))

    for (const [index, option] of remainingOptions.entries()) {
      await tx
        .update(voteOptions)
        .set({
          order: index,
          shortcut: getVoteShortcut(index),
        })
        .where(eq(voteOptions.id, option.id))
    }

    return removed
  })

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Opción no encontrada' })
  }

  return { success: true }
})
