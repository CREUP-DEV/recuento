const ADMIN_LOGIN_PATH = '/admin/login'
const SESSION_RECHECK_INTERVAL_MS = 2 * 60 * 1000

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === ADMIN_LOGIN_PATH) {
    return
  }

  const sessionVerified = useState('admin-session-verified', () => false)
  const adminIsEnvAdmin = useState('admin-is-env-admin', () => false)
  const lastCheckedAt = useState<number>('admin-session-last-checked', () => 0)

  if (import.meta.client && sessionVerified.value) {
    const timeSinceCheck = Date.now() - lastCheckedAt.value
    if (timeSinceCheck < SESSION_RECHECK_INTERVAL_MS) {
      return
    }
  }

  try {
    const session = await $fetch<{
      authenticated: boolean
      envAdmin: boolean
    }>('/api/admin/session', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })

    sessionVerified.value = true
    adminIsEnvAdmin.value = session.envAdmin
    lastCheckedAt.value = Date.now()
  } catch {
    sessionVerified.value = false
    adminIsEnvAdmin.value = false
    lastCheckedAt.value = 0

    return navigateTo(ADMIN_LOGIN_PATH)
  }
})
