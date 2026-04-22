import { defineEventHandler, setHeader } from 'h3'
import { requireAuth } from '../../utils/requireAuth'
import { isEnvAdminEmail, normalizeAdminEmail } from '../../utils/adminAccess'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  setHeader(event, 'cache-control', 'no-store')

  return {
    authenticated: true,
    envAdmin: session.user.email ? isEnvAdminEmail(normalizeAdminEmail(session.user.email)) : false,
  }
})
