import { eq } from 'drizzle-orm'
import { db } from '#db'
import { events } from '#db/schema'
import { saveBannerImage } from '#server-utils/adminImageUpload'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requerido' })

  const [ev] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1)
  if (!ev) throw createError({ statusCode: 404, message: 'Evento no encontrado' })

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No se ha proporcionado un archivo' })
  }

  const file = formData[0]
  if (!file || !file.filename || !file.data) {
    throw createError({ statusCode: 400, message: 'Archivo no válido' })
  }

  const storagePath = await saveBannerImage({
    data: file.data,
    filename: file.filename,
    slug: `event-${id}`,
  })

  await db.update(events).set({ banner: storagePath }).where(eq(events.id, id))

  return { data: { storagePath } }
})
