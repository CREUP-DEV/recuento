import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { events, voteOptions, votes } from '#db/schema'

export async function requireEventInAdminScope(eventId: string) {
  const [eventRecord] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)

  if (!eventRecord) {
    throw createError({ statusCode: 404, message: 'Evento no encontrado' })
  }

  return eventRecord
}

export async function requireVoteInAdminScope(eventId: string, voteId: string) {
  const [voteRecord] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.id, voteId), eq(votes.eventId, eventId)))
    .limit(1)

  if (!voteRecord) {
    throw createError({ statusCode: 404, message: 'Votación no encontrada' })
  }

  return voteRecord
}

export async function requireOptionInAdminScope(eventId: string, voteId: string, optionId: string) {
  await requireVoteInAdminScope(eventId, voteId)

  const [optionRecord] = await db
    .select()
    .from(voteOptions)
    .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
    .limit(1)

  if (!optionRecord) {
    throw createError({ statusCode: 404, message: 'Opción no encontrada' })
  }

  return optionRecord
}
