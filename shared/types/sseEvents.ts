export interface VoteCountUpdateEvent {
  type: 'vote-count-update'
  voteId: string
  eventId: string
  minimumVotes: number | null
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
    canWin: boolean
    thresholdReached: boolean
  }>
}

export interface VoteStatusChangeEvent {
  type: 'vote-status-change'
  voteId: string
  eventId: string
  open: boolean
  startedAt: string | null
  endedAt: string | null
}

export interface VoteClosedEvent {
  type: 'vote-closed'
  voteId: string
  eventId: string
  winnerIds: string[]
  minimumVotes: number | null
  maxWinners: number | null
  confettiEnabled: boolean
}

export type SSEEvent = VoteCountUpdateEvent | VoteStatusChangeEvent | VoteClosedEvent
