import { getRequestHeader } from 'h3'
import { getDatabasePoolStats } from '../db'

export default defineEventHandler(async (event) => {
  // Reject proxied requests — health checks must be direct.
  if (getRequestHeader(event, 'x-forwarded-for')) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const checks: Record<string, string> = {}

  try {
    const stats = getDatabasePoolStats()
    checks.database = stats.errorCount > 0 && stats.lastErrorAt ? 'degraded' : 'ok'
  } catch {
    checks.database = 'error'
  }

  const hasError = Object.values(checks).some((v) => v === 'error')
  const hasDegraded = Object.values(checks).some((v) => v === 'degraded')

  const status = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok'

  setResponseStatus(event, status === 'error' ? 503 : 200)

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  }
})
