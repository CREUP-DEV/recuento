import { and, eq, isNull } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { events, voteOptions, votes } from '#db/schema'
import { getDefaultApiErrorMessage } from './apiErrorMessages'

export async function requireEventInAdminScope(eventId: string) {
  const [eventRecord] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1)

  if (!eventRecord) {
    throw createError({ statusCode: 404, message: getDefaultApiErrorMessage('eventNotFound') })
  }

  return eventRecord
}

export async function requireVoteInAdminScope(eventId: string, voteId: string) {
  const [voteRecord] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.id, voteId), eq(votes.eventId, eventId), isNull(votes.deletedAt)))
    .limit(1)

  if (!voteRecord) {
    throw createError({ statusCode: 404, message: getDefaultApiErrorMessage('voteNotFound') })
  }

  return voteRecord
}

export async function requireOptionInAdminScope(eventId: string, voteId: string, optionId: string) {
  await requireVoteInAdminScope(eventId, voteId)

  const [optionRecord] = await db
    .select()
    .from(voteOptions)
    .where(
      and(
        eq(voteOptions.id, optionId),
        eq(voteOptions.voteId, voteId),
        isNull(voteOptions.deletedAt)
      )
    )
    .limit(1)

  if (!optionRecord) {
    throw createError({ statusCode: 404, message: getDefaultApiErrorMessage('optionNotFound') })
  }

  return optionRecord
}
