import { sql } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'
import { emitContentChanged } from '#server-utils/sseManager'
import { createEventSchema } from '#validation/events'
import { generateEventSlug } from '#server-utils/slug'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = createEventSchema.parse(body)

  const created = await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({ nextOrder: sql<number>`coalesce(max(${events.order}) + 1, 0)` })
      .from(events)
      .where(sql`${events.deletedAt} IS NULL`)

    const slug = data.slug ?? (await generateEventSlug(data.name, tx))

    const [inserted] = await tx
      .insert(events)
      .values({
        name: data.name,
        slug,
        startDate: data.startDate,
        endDate: data.endDate,
        visible: data.visible,
        order: orderRow?.nextOrder ?? 0,
      })
      .returning()

    return inserted
  })

  if (!created)
    throw createError({ statusCode: 500, message: getApiErrorMessage(event, 'eventCreateFailed') })

  emitContentChanged({ type: 'content-changed', scope: 'events', eventId: created.id })
  await writeAuditLog(event, {
    action: 'event.create',
    targetType: 'event',
    targetId: created.id,
    after: created,
  })

  return { data: created }
})
