import { z } from 'zod'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { voteOptions } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) throw createError({ statusCode: 400, message: 'IDs requeridos' })

  const body = await readBody(event)
  const { orderedIds } = reorderSchema.parse(body)

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

    // Single UPDATE with CASE WHEN avoids unique constraint violations
    // that would occur with sequential per-row updates inside a transaction.
    const orderCases = orderedIds.map((id, idx) => sql`WHEN ${id} THEN ${idx}`)
    const shortcutCases = orderedIds.map(
      (id, idx) => sql`WHEN ${id} THEN ${idx < 9 ? String(idx + 1) : null}`
    )
    await tx.execute(
      sql`UPDATE vote_options
          SET "order"  = CASE id ${sql.join(orderCases, sql` `)} END,
              shortcut = CASE id ${sql.join(shortcutCases, sql` `)} END,
              updated_at = now()
          WHERE vote_id = ${voteId}`
    )

    return tx
      .select()
      .from(voteOptions)
      .where(eq(voteOptions.voteId, voteId))
      .orderBy(asc(voteOptions.order))
  })

  return { data: updated }
})
