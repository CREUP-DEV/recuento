import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { adminAccess } from '#db/schema'
import { assertAdminAccessCanBeRevoked, getAdminAccessForUpdate } from '#server-utils/adminAccess'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredId') })

  const removed = await db.transaction(async (tx) => {
    const entry = await getAdminAccessForUpdate(tx, id)
    if (!entry)
      throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'accessNotFound') })

    await assertAdminAccessCanBeRevoked(tx, entry)
    await tx.delete(adminAccess).where(eq(adminAccess.id, id))

    return entry
  })

  await writeAuditLog(event, {
    action: 'admin_access.delete',
    targetType: 'admin_access',
    targetId: id,
    before: removed,
  })

  return { data: { success: true } }
})
