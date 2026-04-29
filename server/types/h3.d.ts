import type { AdminSession } from '../utils/requireAuth'

declare module 'h3' {
  interface H3EventContext {
    adminSession?: AdminSession
    requestId?: string
  }
}

export {}
