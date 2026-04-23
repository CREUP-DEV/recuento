export const DEFAULT_OPTION_COLORS = ['#86efac', '#fca5a5', '#fde68a', '#93c5fd'] as const

export const VOTE_SHORTCUTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export const SUGGESTED_OPTION_LABEL_KEYS = [
  ['inFavor', 'yes'],
  ['against', 'no'],
  ['blank', 'abstention'],
  ['invalid'],
] as const

export function getVoteShortcut(index: number) {
  return VOTE_SHORTCUTS[index] ?? null
}
