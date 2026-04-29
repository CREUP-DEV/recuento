import { logError } from './logger'

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase()
}

const ADMIN_EMAIL_CACHE_TTL_MS = 60_000

let cachedEnvAdminEmails: string[] | null = null
let cachedEnvAdminEmailsExpiresAt = 0

export function getEnvAdminEmails() {
  if (cachedEnvAdminEmails !== null && Date.now() < cachedEnvAdminEmailsExpiresAt) {
    return cachedEnvAdminEmails
  }

  const rawEmails = process.env.ADMIN_EMAILS

  if (!rawEmails || rawEmails.trim() === '') {
    logError('adminAccess.env', new Error('Missing ADMIN_EMAILS configuration'), {
      message:
        'ADMIN_EMAILS env var is not set, no users can authenticate. Set ADMIN_EMAILS=user@example.com in .env and restart.',
    })
    cachedEnvAdminEmails = []
    cachedEnvAdminEmailsExpiresAt = Date.now() + ADMIN_EMAIL_CACHE_TTL_MS
    return cachedEnvAdminEmails
  }

  cachedEnvAdminEmails = Array.from(
    new Set(
      rawEmails
        .split(/[,\s]+/)
        .map((email) => normalizeAdminEmail(email))
        .filter(Boolean)
    )
  )
  cachedEnvAdminEmailsExpiresAt = Date.now() + ADMIN_EMAIL_CACHE_TTL_MS

  return cachedEnvAdminEmails
}

export function clearEnvAdminEmailsCache() {
  cachedEnvAdminEmails = null
  cachedEnvAdminEmailsExpiresAt = 0
}

export function isEnvAdminEmail(email: string) {
  return getEnvAdminEmails().includes(normalizeAdminEmail(email))
}

export async function isAdminEmailAuthorized(email: string) {
  const normalizedEmail = normalizeAdminEmail(email)

  if (!normalizedEmail) {
    return false
  }

  // Env-configured emails are always authoritative
  return isEnvAdminEmail(normalizedEmail)
}
