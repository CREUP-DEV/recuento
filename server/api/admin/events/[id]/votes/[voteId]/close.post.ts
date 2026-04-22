import { eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { votes } from '#db/schema'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitVoteStatusChange } from '#server-utils/sseManager'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: 'IDs requeridos' })
  }

  const vote = await requireVoteInAdminScope(eventId, voteId)

  if (!vote.open) {
    throw createError({ statusCode: 400, message: 'La votación ya está cerrada' })
  }

  const [updated] = await db
    .update(votes)
    .set({ open: false, endedAt: sql`now()` })
    .where(eq(votes.id, voteId))
    .returning()

  if (!updated) throw createError({ statusCode: 500, message: 'Error al cerrar la votación' })

  emitVoteStatusChange({
    type: 'vote-status-change',
    voteId: updated.id,
    eventId: updated.eventId,
    open: false,
    startedAt: updated.startedAt?.toISOString() ?? null,
    endedAt: updated.endedAt?.toISOString() ?? null,
  })

  return { data: updated }
})
