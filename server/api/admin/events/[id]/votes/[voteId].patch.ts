import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#db'
import { votes } from '#db/schema'
import { pickDefined } from '#server-utils/pickDefined'
import { requireVoteInAdminScope } from '#server-utils/adminVoteScope'
import { emitContentChanged, emitVoteStatusChange } from '#server-utils/sseManager'
import { emitVoteCountUpdate } from '#server-utils/voteCountEmitter'
import { updateVoteSchema } from '#validation/votes'
import { generateVoteSlug } from '#server-utils/slug'
import { writeAuditLog } from '#server-utils/auditLog'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const voteId = getRouterParam(event, 'voteId')
  if (!eventId || !voteId) {
    throw createError({ statusCode: 400, message: getApiErrorMessage(event, 'requiredIds') })
  }

  const currentVote = await requireVoteInAdminScope(eventId, voteId)

  const body = await readBody(event)
  const data = updateVoteSchema.parse(body)

  if (currentVote.open && data.visible === false) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteHiddenOpenBlocked'),
    })
  }

  if (currentVote.open && (data.minimumVotes !== undefined || data.maxWinners !== undefined)) {
    throw createError({
      statusCode: 409,
      message: getApiErrorMessage(event, 'voteResultSettingsLocked'),
    })
  }

  const updateData = pickDefined(data, [
    'name',
    'slug',
    'visible',
    'minimumVotes',
    'maxWinners',
    'confettiEnabled',
  ])
  if (data.name && data.slug === undefined && data.name !== currentVote.name) {
    updateData.slug = await generateVoteSlug(data.name, db, voteId)
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: getApiErrorMessage(event, 'missingUpdateFields'),
    })
  }

  const [updated] = await db.update(votes).set(updateData).where(eq(votes.id, voteId)).returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: getApiErrorMessage(event, 'voteNotFound') })
  }

  if (data.visible !== undefined) {
    emitVoteStatusChange({
      type: 'vote-status-change',
      voteId: updated.id,
      eventId,
      open: updated.open,
      visible: updated.visible,
      startedAt: updated.startedAt?.toISOString() ?? null,
      endedAt: updated.endedAt?.toISOString() ?? null,
    })
  }

  if (
    !updated.open &&
    (data.minimumVotes !== undefined ||
      data.maxWinners !== undefined ||
      data.confettiEnabled !== undefined)
  ) {
    emitVoteCountUpdate(voteId)
  }

  emitContentChanged({ type: 'content-changed', scope: 'vote', eventId, voteId })
  await writeAuditLog(event, {
    action: 'vote.update',
    targetType: 'vote',
    targetId: voteId,
    before: currentVote,
    after: updated,
  })

  return { data: updated }
})
