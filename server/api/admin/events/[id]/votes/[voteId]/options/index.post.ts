import { eq } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { createOptionSchema } from '#validation/options'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) throw createError({ statusCode: 400, message: 'IDs requeridos' })

  const body = await readBody(event)
  const data = createOptionSchema.parse(body)
  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (vote.open) {
    throw createError({
      statusCode: 409,
      message: 'No se pueden cambiar las opciones mientras la votación está abierta.',
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
      .where(eq(voteOptions.voteId, voteId))

    if (data.shortcut && existingOptions.some((option) => option.shortcut === data.shortcut)) {
      throw createError({
        statusCode: 409,
        message: 'El atajo ya está en uso en esta votación.',
      })
    }

    const nextOrder =
      existingOptions.reduce((maxOrder, option) => Math.max(maxOrder, option.order), -1) + 1
    const defaultColor = DEFAULT_OPTION_COLORS[nextOrder % DEFAULT_OPTION_COLORS.length]
    const fallbackShortcut =
      Array.from({ length: 9 }, (_, index) => String(index + 1)).find(
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
      })
      .returning()

    return inserted
  })

  return { data: created }
})
