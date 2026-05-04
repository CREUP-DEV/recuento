import { and, eq, isNull } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const [openVote] = await db
    .select({
      id: votes.id,
      eventId: votes.eventId,
      startedAt: votes.startedAt,
    })
    .from(votes)
    .where(and(eq(votes.eventId, id), eq(votes.open, true)))
    .limit(1)

  const [deleted] = await db
    .update(events)
    .set({ visible: false, deletedAt: new Date() })
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })
  }

  await db
    .update(votes)
    .set({ visible: false, open: false, deletedAt: new Date() })
    .where(eq(votes.eventId, id))

  if (openVote) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId: openVote.id,
      eventId: openVote.eventId,
      open: false,
      visible: false,
      startedAt: openVote.startedAt?.toISOString() ?? null,
      endedAt: new Date().toISOString(),
    })
  }

  emitContentChanged({ type: 'content-changed', scope: 'events', eventId: id })
  await writeAuditLog(event, {
    action: 'event.delete',
    targetType: 'event',
    targetId: id,
    before: deleted,
  })

  return { success: true }
})
