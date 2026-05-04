import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { adminAccess } from '#db/schema'
import { assertAdminAccessCanBeRevoked, getAdminAccessForUpdate } from '#server-utils/adminAccess'
import { writeAuditLog } from '#server-utils/auditLog'
import { updateAdminAccessSchema } from '#validation/adminAccess'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const body = await readBody(event)
  const data = updateAdminAccessSchema.parse(body)

  const { before, updated } = await db.transaction(async (tx) => {
    const entry = await getAdminAccessForUpdate(tx, id)
    if (!entry)
      throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'accessNotFound') })

    if (!data.active) {
      await assertAdminAccessCanBeRevoked(tx, entry)
    }

    const [row] = await tx
      .update(adminAccess)
      .set({ active: data.active })
      .where(eq(adminAccess.id, id))
      .returning()

    if (!row)
      throw createError({
        statusCode: 500,
        message: getApiErrorMessage(event, 'accessUpdateFailed'),
      })

    return { before: entry, updated: row }
  })

  await writeAuditLog(event, {
    action: 'admin_access.update',
    targetType: 'admin_access',
    targetId: id,
    before,
    after: updated,
  })

  return { data: updated }
})
