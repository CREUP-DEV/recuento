import { eq } from 'drizzle-orm'
import { db } from '#db'
import { votes } from '#db/schema'
import { emitVoteStatusChange } from '#server-utils/sseManager'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) throw createError({ statusCode: 400, message: 'IDs requeridos' })

  const vote = await requireVoteInAdminScope(eventId, voteId)

  const [deleted] = await db
    .delete(votes)
    .where(eq(votes.id, voteId))
    .returning({ id: votes.id, eventId: votes.eventId })

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Votación no encontrada' })
  }

  if (vote.open) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId,
      eventId: deleted.eventId,
      open: false,
      startedAt: vote.startedAt?.toISOString() ?? null,
      endedAt: new Date().toISOString(),
    })
  }

  return { success: true }
})
