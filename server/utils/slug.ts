import { and, eq, ne, sql } from 'drizzle-orm'
import type { db } from '../db'
import { events, votes } from '../db/schema'

type SlugExecutor = Pick<typeof db, 'execute' | 'query'>

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export async function generateEventSlug(name: string, executor: SlugExecutor, excludeId?: string) {
  const baseSlug = slugify(name) || 'event'
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`event:${baseSlug}`}))`)

  let candidate = baseSlug
  let suffix = 2

  while (suffix < 100) {
    const existing = await executor.query.events.findFirst({
      where: excludeId
        ? and(
            eq(events.slug, candidate),
            ne(events.id, excludeId),
            sql`${events.deletedAt} IS NULL`
          )
        : and(eq(events.slug, candidate), sql`${events.deletedAt} IS NULL`),
    })

    if (!existing) return candidate

    candidate = `${baseSlug}-${suffix}`
    suffix++
  }

  throw new Error('Could not generate a unique event slug')
}

export async function generateVoteSlug(name: string, executor: SlugExecutor, excludeId?: string) {
  const baseSlug = slugify(name) || 'vote'
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`vote:${baseSlug}`}))`)

  let candidate = baseSlug
  let suffix = 2

  while (suffix < 100) {
    const existing = await executor.query.votes.findFirst({
      where: excludeId
        ? and(eq(votes.slug, candidate), ne(votes.id, excludeId), sql`${votes.deletedAt} IS NULL`)
        : and(eq(votes.slug, candidate), sql`${votes.deletedAt} IS NULL`),
    })

    if (!existing) return candidate

    candidate = `${baseSlug}-${suffix}`
    suffix++
  }

  throw new Error('Could not generate a unique vote slug')
}
