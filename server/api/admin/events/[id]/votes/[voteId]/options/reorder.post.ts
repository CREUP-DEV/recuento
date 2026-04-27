import { z } from 'zod'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { getVoteShortcut } from '~~/shared/constants/voteOptions'

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
  colorOverrides: z.record(z.string(), z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) throw createError({ statusCode: 400, message: 'IDs requeridos' })

  const body = await readBody(event)
  const { orderedIds, colorOverrides } = reorderSchema.parse(body)

  const vote = await requireVoteInAdminScope(eventId, voteId)
  if (vote.open) {
    throw createError({
      statusCode: 409,
      message: 'No se pueden cambiar las opciones mientras la votación está abierta.',
    })
  }

  const updated = await db.transaction(async (tx) => {
    const existingOptions = await tx
      .select({ id: voteOptions.id })
      .from(voteOptions)
      .where(eq(voteOptions.voteId, voteId))
      .orderBy(asc(voteOptions.order))

    const existingIds = existingOptions.map((option) => option.id).sort()
    const nextIds = [...orderedIds].sort()

    const hasDuplicates = new Set(orderedIds).size !== orderedIds.length
    const sameSet =
      existingIds.length === nextIds.length &&
      existingIds.every((id, index) => id === nextIds[index])

    if (hasDuplicates || !sameSet) {
      throw createError({
        statusCode: 400,
        message: 'Las opciones enviadas no coinciden con las opciones actuales de la votación.',
      })
    }

    // Move current orders out of the constrained range first so the final
    // reassignment cannot collide with the unique (vote_id, order) index.
    await tx.execute(
      sql`UPDATE vote_options
          SET "order" = "order" + ${orderedIds.length},
              shortcut = CASE
                WHEN shortcut IS NULL THEN NULL
                ELSE CONCAT('__tmp__', id)
              END,
              updated_at = now()
          WHERE vote_id = ${voteId}`
    )

    const orderCases = orderedIds.map((id, idx) => sql`WHEN ${id} THEN ${sql.raw(String(idx))}`)
    const shortcutCases = orderedIds.map((id, idx) => sql`WHEN ${id} THEN ${getVoteShortcut(idx)}`)
    await tx.execute(
      sql`UPDATE vote_options
          SET "order"  = CASE id ${sql.join(orderCases, sql` `)} END,
              shortcut = CASE id ${sql.join(shortcutCases, sql` `)} END,
              updated_at = now()
          WHERE vote_id = ${voteId}`
    )

    if (colorOverrides && Object.keys(colorOverrides).length > 0) {
      const colorCases = Object.entries(colorOverrides).map(
        ([id, color]) => sql`WHEN ${id} THEN ${color}`
      )
      await tx.execute(
        sql`UPDATE vote_options
            SET color = CASE id ${sql.join(colorCases, sql` `)} ELSE color END,
                updated_at = now()
            WHERE vote_id = ${voteId}`
      )
    }

    return tx
      .select()
      .from(voteOptions)
      .where(eq(voteOptions.voteId, voteId))
      .orderBy(asc(voteOptions.order))
  })

  emitVoteCountUpdate(voteId)

  return { data: updated }
})
