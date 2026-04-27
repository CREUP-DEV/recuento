export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase()
}

let cachedEnvAdminEmails: string[] | null = null

export function getEnvAdminEmails() {
  if (cachedEnvAdminEmails !== null) {
    return cachedEnvAdminEmails
  }

  const rawEmails = process.env.ADMIN_EMAILS

  if (!rawEmails || rawEmails.trim() === '') {
    // logError so it surfaces clearly in production logs with remediation hint
    console.error(
      JSON.stringify({
        level: 'error',
        scope: 'adminAccess',
        message:
          'ADMIN_EMAILS env var is not set, no users can authenticate. Set ADMIN_EMAILS=user@example.com in .env and restart.',
      })
    )
    cachedEnvAdminEmails = []
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

  return cachedEnvAdminEmails
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
