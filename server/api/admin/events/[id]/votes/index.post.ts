import { and, eq, sql } from 'drizzle-orm'
import { db } from '#db'
import { events, votes } from '#db/schema'
import { emitContentChanged } from '#server-utils/sseManager'
import { createVoteSchema } from '#validation/votes'
import { generateVoteSlug } from '#server-utils/slug'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId)
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredEventId') })

  const [parentEvent] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!parentEvent) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })
  }

  const body = await readBody(event)
  const data = createVoteSchema.parse(body)

  const created = await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({ nextOrder: sql<number>`coalesce(max(${votes.order}) + 1, 0)` })
      .from(votes)
      .where(and(eq(votes.eventId, eventId), sql`${votes.deletedAt} IS NULL`))

    const slug = data.slug ?? (await generateVoteSlug(data.name, tx))

    const [inserted] = await tx
      .insert(votes)
      .values({
        eventId,
        name: data.name,
        slug,
        visible: data.visible,
        order: orderRow?.nextOrder ?? 0,
        minimumVotes: data.minimumVotes ?? null,
        maxWinners: data.maxWinners ?? null,
      })
      .returning()

    return inserted
  })

  if (!created)
    throw createError({ statusCode: 500, message: getApiErrorMessage(event, 'voteCreateFailed') })

  emitContentChanged({ type: 'content-changed', scope: 'vote', eventId, voteId: created.id })
  await writeAuditLog(event, {
    action: 'vote.create',
    targetType: 'vote',
    targetId: created.id,
    after: created,
  })

  return { data: created }
})
