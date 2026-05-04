import { sql } from 'drizzle-orm'
import { db } from '../db'
import { idempotencyKeys } from '../db/schema'

const WINDOW_MS = 5 * 60 * 1000

export async function isDuplicateRequest(voteId: string, nonce: string): Promise<boolean> {
  const trimmedNonce = nonce.trim()
  if (!trimmedNonce || trimmedNonce.length > 200) {
    return false
  }

  const scope = `vote:${voteId}`
  const expiresAt = new Date(Date.now() + WINDOW_MS)

  await db
    .delete(idempotencyKeys)
    .where(sql`${idempotencyKeys.expiresAt} < now()`)
    .catch(() => undefined)

  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      scope,
      key: trimmedNonce,
      expiresAt,
    })
    .onConflictDoNothing({ target: [idempotencyKeys.scope, idempotencyKeys.key] })
    .returning({ id: idempotencyKeys.id })

  return inserted.length === 0
}
