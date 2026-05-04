import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireOptionInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitContentChanged } from '#server-utils/sseManager'
import { getVoteShortcut } from '~~/shared/constants/voteOptions'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)
  await requireOptionInAdminScope(eventId, voteId, optionId)

  if (vote.open) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'optionChangeWhileOpen'),
    })
  }

  const deleted = await db.transaction(async (tx) => {
    const [removed] = await tx
      .update(voteOptions)
      .set({ deletedAt: new Date(), shortcut: null })
      .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
      .returning()

    const remainingOptions = await tx
      .select({ id: voteOptions.id })
      .from(voteOptions)
      .where(and(eq(voteOptions.voteId, voteId), isNull(voteOptions.deletedAt)))
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
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'optionNotFound') })
  }

  emitContentChanged({ type: 'content-changed', scope: 'options', eventId, voteId })
  await writeAuditLog(event, {
    action: 'option.delete',
    targetType: 'option',
    targetId: optionId,
    before: deleted,
  })

  return { success: true }
})
