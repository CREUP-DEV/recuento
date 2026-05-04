import { and, eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { deleteBannerFile } from '#server-utils/adminImageUpload'
import { pickDefined } from '#server-utils/pickDefined'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
import { updateEventSchema, validateEventDateRange } from '#validation/events'
import { generateEventSlug } from '#server-utils/slug'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const [existing] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), sql`${events.deletedAt} IS NULL`))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })
  }

  const body = await readBody(event)
  const data = updateEventSchema.parse(body)

  const startDate = data.startDate ?? existing.startDate
  const endDate = data.endDate ?? existing.endDate

  if (!validateEventDateRange(startDate, endDate)) {
    throw createError({
      statusCode: 400,
      message: getApiErrorMessage(event, 'invalidDateRange'),
    })
  }

  if (data.visible === false) {
    const [openVote] = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.eventId, id), eq(votes.open, true)))
      .limit(1)

    if (openVote) {
      throw createError({
        statusCode: 409,
        message: getApiErrorMessage(event, 'eventHasOpenVote'),
      })
    }
  }

  const updateData = pickDefined(data, [
    'name',
    'slug',
    'startDate',
    'endDate',
    'visible',
    'banner',
  ])
  if (data.name && data.slug === undefined && data.name !== existing.name) {
    updateData.slug = await generateEventSlug(data.name, db, id)
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: getApiErrorMessage(event, 'missingUpdateFields'),
    })
  }

  const [updated] = await db.update(events).set(updateData).where(eq(events.id, id)).returning()

  if (data.banner === null && existing.banner) {
    await deleteBannerFile(existing.banner)
  }

  if (data.visible !== undefined) {
    const eventVotes = await db
      .select({
        id: votes.id,
        open: votes.open,
        visible: votes.visible,
        startedAt: votes.startedAt,
        endedAt: votes.endedAt,
      })
      .from(votes)
      .where(eq(votes.eventId, id))

    for (const v of eventVotes) {
      emitVoteStatusChange({
        type: 'vote-status-change',
        voteId: v.id,
        eventId: id,
        open: v.open,
        visible: data.visible && v.visible,
        startedAt: v.startedAt?.toISOString() ?? null,
        endedAt: v.endedAt?.toISOString() ?? null,
      })
    }
  }

  emitContentChanged({ type: 'content-changed', scope: 'event', eventId: id })
  await writeAuditLog(event, {
    action: 'event.update',
    targetType: 'event',
    targetId: id,
    before: existing,
    after: updated,
  })

  return { data: updated }
})
