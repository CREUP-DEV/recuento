import { createError } from 'h3'
import { db } from '#db'
import { adminAccess } from '#db/schema'
import { normalizeAdminEmail } from '#server-utils/adminAccess'
import { writeAuditLog } from '#server-utils/auditLog'
import { createAdminAccessSchema } from '#validation/adminAccess'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = createAdminAccessSchema.parse(body)
  const email = normalizeAdminEmail(data.email)

  const [created] = await db
    .insert(adminAccess)
    .values({ email, active: data.active })
    .onConflictDoNothing({ target: adminAccess.email })
    .returning()

  if (!created) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'accessAlreadyExists'),
    })
  }

  await writeAuditLog(event, {
    action: 'admin_access.create',
    targetType: 'admin_access',
    targetId: created.id,
    after: created,
  })

  return { data: created }
})
