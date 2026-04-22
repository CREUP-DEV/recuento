import { and, eq } from 'drizzle-orm'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { emitVoteStatusChange } from '#server-utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

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
    .delete(events)
    .where(eq(events.id, id))
    .returning({ id: events.id, banner: events.banner })

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  if (deleted.banner) {
    const filename = deleted.banner.split('/').pop()
    if (filename) {
      await unlink(join(process.cwd(), 'public/banners', filename)).catch(() => {
        // File already gone — not an error
      })
    }
  }

  if (openVote) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId: openVote.id,
      eventId: openVote.eventId,
      open: false,
      startedAt: openVote.startedAt?.toISOString() ?? null,
      endedAt: new Date().toISOString(),
    })
  }

  return { success: true }
})
