import type { H3Event } from 'h3'
import { createError } from 'h3'
import { auth } from './auth'
import { isAdminEmailAuthorized, normalizeAdminEmail } from './adminAccess'

export type AdminSession = Awaited<ReturnType<typeof auth.api.getSession>>

export async function requireAuth(event: H3Event) {
  if (event.context.adminSession) {
    return event.context.adminSession
  }

  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      message: 'No autorizado',
    })
  }

  const normalizedEmail = session.user.email ? normalizeAdminEmail(session.user.email) : ''
  if (!normalizedEmail || !(await isAdminEmailAuthorized(normalizedEmail))) {
    throw createError({
      statusCode: 403,
      message: 'Acceso no autorizado',
    })
  }

  event.context.adminSession = session

  return session
}
