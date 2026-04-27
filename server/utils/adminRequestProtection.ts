import { createError, getRequestHeader, getRequestURL, type H3Event } from 'h3'

const UNSAFE_ADMIN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isUnsafeAdminMethod(method: string) {
  return UNSAFE_ADMIN_METHODS.has(method.toUpperCase())
}

function isSameOriginAdminRequest(event: H3Event) {
  const requestOrigin = getRequestURL(event).origin
  const originHeader = getRequestHeader(event, 'origin')?.trim()

  if (originHeader) {
    try {
      return new URL(originHeader).origin === requestOrigin
    } catch {
      return false
    }
  }

  // Sec-Fetch-Site is the fallback for same-origin navigations that omit Origin.
  // If neither header is present (curl, server-to-server), deny — don't assume safe.
  const fetchSite = getRequestHeader(event, 'sec-fetch-site')?.trim().toLowerCase()
  if (!fetchSite) return false
  return fetchSite === 'same-origin'
}

export function assertSameOriginAdminMutationRequest(event: H3Event) {
  if (!isUnsafeAdminMethod(event.method)) {
    return
  }

  if (isSameOriginAdminRequest(event)) {
    return
  }

  throw createError({
    statusCode: 403,
    message: 'Solicitud no permitida.',
  })
}
