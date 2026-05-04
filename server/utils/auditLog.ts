import type { H3Event } from 'h3'
import { db } from '../db'
import { auditLog } from '../db/schema'
import type { AdminSession } from './requireAuth'

interface AuditLogInput {
  action: string
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
}

export async function writeAuditLog(event: H3Event, input: AuditLogInput) {
  const session = event.context.adminSession as AdminSession | undefined

  await db.insert(auditLog).values({
    actorEmail: session?.user.email ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
  })
}
