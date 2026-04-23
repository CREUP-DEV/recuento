import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

export interface VoteResultOption {
  label: string
  count: number
  color?: string | null
}

const RESULT_EMOJIS = ['🟩', '🟥', '⬜', '🟦', '🟨', '🟪', '🟧', '🟫'] as const

export function getDefaultOptionColor(index: number) {
  return DEFAULT_OPTION_COLORS[index % DEFAULT_OPTION_COLORS.length] ?? DEFAULT_OPTION_COLORS[0]
}

export function getOptionDisplayColor(color: string | null | undefined, index: number) {
  return color ?? getDefaultOptionColor(index)
}

export function getMobileOptionButtonStyle(color: string) {
  const normalized = color.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((chunk) => `${chunk}${chunk}`)
          .join('')
      : normalized

  const red = parseInt(expanded.slice(0, 2), 16)
  const green = parseInt(expanded.slice(2, 4), 16)
  const blue = parseInt(expanded.slice(4, 6), 16)
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114

  return {
    backgroundColor: color,
    color: luminance > 186 ? '#111827' : '#ffffff',
  }
}

export function buildVoteResultsText(
  voteName: string,
  totalLabel: string,
  totalVotes: number,
  options: VoteResultOption[]
) {
  return [
    `🗳️ ${voteName}`,
    `📊 ${totalLabel}: ${totalVotes}`,
    ...options.map((option, index) => {
      const emoji = RESULT_EMOJIS[index] ?? '🔹'

      return `${emoji} ${option.label}: ${option.count}`
    }),
  ].join('\n')
}

export function getOptionSuggestionLabels(
  t: (key: string) => string,
  keys: readonly string[] | undefined
) {
  return (keys ?? []).map((key) => t(`voteOptions.suggestions.${key}`))
}
