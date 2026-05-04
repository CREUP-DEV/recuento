import { and, eq, isNull, ne } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { pickDefined } from '#server-utils/pickDefined'
import { requireOptionInAdminScope, requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitContentChanged } from '#server-utils/sseManager'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { updateOptionSchema } from '#validation/options'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !optionId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const body = await readBody(event)
  const data = updateOptionSchema.parse(body)
  const vote = await requireVoteInAdminScope(eventId, voteId)
  await requireOptionInAdminScope(eventId, voteId, optionId)

  const isStructuralChange =
    data.label !== undefined ||
    data.color !== undefined ||
    data.shortcut !== undefined ||
    data.canWin !== undefined

  if (vote.open && isStructuralChange) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'optionChangeWhileOpen'),
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
          isNull(voteOptions.deletedAt),
          ne(voteOptions.id, optionId)
        )
      )
      .limit(1)

    if (existingShortcut) {
      throw createError({
        statusCode: 409,
        message: getApiErrorMessage(event, 'duplicateAccessShortcut'),
      })
    }
  }

  const updateData = pickDefined(data, ['label', 'color', 'shortcut', 'count', 'canWin'])

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: getApiErrorMessage(event, 'missingUpdateFields'),
    })
  }

  const [updated] = await db
    .update(voteOptions)
    .set(updateData)
    .where(
      and(
        eq(voteOptions.id, optionId),
        eq(voteOptions.voteId, voteId),
        isNull(voteOptions.deletedAt)
      )
    )
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'optionNotFound') })
  }

  if (
    data.count !== undefined ||
    data.color !== undefined ||
    data.label !== undefined ||
    data.shortcut !== undefined ||
    data.canWin !== undefined
  ) {
    await emitVoteCountUpdate(voteId)
  }

  emitContentChanged({ type: 'content-changed', scope: 'options', eventId, voteId })

  return { data: updated }
})
