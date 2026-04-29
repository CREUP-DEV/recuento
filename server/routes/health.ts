import { getRequestHeader } from 'h3'
import { getDatabasePoolStats } from '../db'

export default defineEventHandler(async (event) => {
  // Only allow direct Docker/internal requests — NGINX always sets X-Forwarded-For.
  if (getRequestHeader(event, 'x-forwarded-for')) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const checks: Record<string, string> = {}

  try {
    const stats = getDatabasePoolStats()
    checks.database = stats.errorCount > 0 && stats.lastErrorAt ? 'error' : 'ok'
  } catch {
    checks.database = 'error'
  }

  const hasError = Object.values(checks).some((v) => v === 'error')
  const status = hasError ? 'error' : 'ok'

  setResponseStatus(event, status === 'error' ? 503 : 200)

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  }
})
