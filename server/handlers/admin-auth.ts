import { defineEventHandler } from 'h3'
import { requireAuth, type AdminAuthEventContext } from '../utils/requireAuth'
import { assertSameOriginAdminMutationRequest } from '../utils/adminRequestProtection'

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') {
    return
  }

  assertSameOriginAdminMutationRequest(event)
  const session = await requireAuth(event)
  const context = event.context as AdminAuthEventContext
  context.adminSession = session
})
