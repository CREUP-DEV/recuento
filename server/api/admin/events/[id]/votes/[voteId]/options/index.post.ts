import { and, eq, isNull } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { DEFAULT_OPTION_COLORS, VOTE_SHORTCUTS } from '~~/shared/constants/voteOptions'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitContentChanged } from '#server-utils/sseManager'
import { createOptionSchema } from '#validation/options'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId)
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })

  const body = await readBody(event)
  const data = createOptionSchema.parse(body)
  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (vote.open) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'optionChangeWhileOpen'),
    })
  }

  const created = await db.transaction(async (tx) => {
    const existingOptions = await tx
      .select({
        id: voteOptions.id,
        order: voteOptions.order,
        shortcut: voteOptions.shortcut,
      })
      .from(voteOptions)
      .where(and(eq(voteOptions.voteId, voteId), isNull(voteOptions.deletedAt)))

    if (data.shortcut && existingOptions.some((option) => option.shortcut === data.shortcut)) {
      throw createError({
        statusCode: 409,
        message: getApiErrorMessage(event, 'duplicateAccessShortcut'),
      })
    }

    const nextOrder =
      existingOptions.reduce((maxOrder, option) => Math.max(maxOrder, option.order), -1) + 1
    const defaultColor = DEFAULT_OPTION_COLORS[nextOrder % DEFAULT_OPTION_COLORS.length]
    const fallbackShortcut =
      VOTE_SHORTCUTS.find(
        (shortcut) => !existingOptions.some((option) => option.shortcut === shortcut)
      ) ?? null

    const [inserted] = await tx
      .insert(voteOptions)
      .values({
        voteId,
        label: data.label,
        color: data.color ?? defaultColor,
        shortcut: data.shortcut ?? fallbackShortcut,
        order: nextOrder,
        canWin: data.canWin ?? true,
      })
      .returning()

    return inserted
  })

  emitContentChanged({ type: 'content-changed', scope: 'options', eventId, voteId })

  return { data: created }
})
