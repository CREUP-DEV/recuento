import { eq } from 'drizzle-orm'
import { db } from '#db'
import { votes } from '#db/schema'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId)
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })

  const vote = await requireVoteInAdminScope(eventId, voteId)

  const [deleted] = await db
    .update(votes)
    .set({ visible: false, open: false, deletedAt: new Date() })
    .where(eq(votes.id, voteId))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'voteNotFound') })
  }

  if (vote.open) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId,
      eventId: deleted.eventId,
      open: false,
      visible: false,
      startedAt: vote.startedAt?.toISOString() ?? null,
      endedAt: new Date().toISOString(),
    })
  }

  emitContentChanged({ type: 'content-changed', scope: 'vote', eventId: deleted.eventId, voteId })
  await writeAuditLog(event, {
    action: 'vote.delete',
    targetType: 'vote',
    targetId: voteId,
    before: vote,
  })

  return { success: true }
})
