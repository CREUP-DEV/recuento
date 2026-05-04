import type { events, voteOptions, votes } from '../db/schema'

type EventRow = typeof events.$inferSelect
type VoteRow = typeof votes.$inferSelect
type VoteOptionRow = typeof voteOptions.$inferSelect

export function toPublicEvent(event: EventRow) {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    banner: event.banner,
    startDate: event.startDate,
    endDate: event.endDate,
  }
}

export function toPublicVoteOption(option: VoteOptionRow) {
  return {
    id: option.id,
    label: option.label,
    color: option.color,
    count: option.count,
    canWin: option.canWin,
  }
}

export function toPublicVote(vote: VoteRow, options: VoteOptionRow[] = []) {
  return {
    id: vote.id,
    slug: vote.slug,
    eventId: vote.eventId,
    name: vote.name,
    open: vote.open,
    startedAt: vote.startedAt,
    endedAt: vote.endedAt,
    minimumVotes: vote.minimumVotes,
    maxWinners: vote.maxWinners,
    confettiEnabled: vote.confettiEnabled,
    options: options.map(toPublicVoteOption),
  }
}
