import { and, eq, isNull } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'
import { saveBannerImage } from '#server-utils/adminImageUpload'
import { emitContentChanged } from '#server-utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const [ev] = await db
    .select({ id: events.id, slug: events.slug })
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1)
  if (!ev)
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'eventNotFound') })

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'bannerMissingFile') })
  }

  const file = formData[0]
  if (!file || !file.filename || !file.data) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'bannerInvalidFile') })
  }

  const storagePath = await saveBannerImage({
    data: file.data,
    filename: file.filename,
    slug: `event-${ev.slug}`,
  })

  await db.update(events).set({ banner: storagePath }).where(eq(events.id, id))

  emitContentChanged({ type: 'content-changed', scope: 'event', eventId: id })

  return { data: { storagePath } }
})
