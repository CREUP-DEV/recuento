import { defineEventHandler } from 'h3'
import { requireAuth } from '../utils/requireAuth'
import { assertSameOriginAdminMutationRequest } from '../utils/adminRequestProtection'

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') {
    return
  }

  assertSameOriginAdminMutationRequest(event)
  event.context.adminSession = await requireAuth(event)
})
