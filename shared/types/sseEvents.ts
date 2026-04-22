export interface VoteCountUpdateEvent {
  type: 'vote-count-update'
  voteId: string
  eventId: string
  options: Array<{
    id: string
    label: string
    color: string | null
    count: number
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

export type SSEEvent = VoteCountUpdateEvent | VoteStatusChangeEvent
