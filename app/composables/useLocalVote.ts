import { useLocalStorage } from '@vueuse/core'
import { DEFAULT_OPTION_COLORS } from '~~/shared/constants/voteOptions'

export interface LocalVoteOption {
  id: string
  label: string
  color: string | null
  count: number
  shortcut: string | null
}

export interface LocalVoteState {
  name: string
  open: boolean
  options: LocalVoteOption[]
}

const DEFAULT_STATE: LocalVoteState = {
  name: 'Votación local',
  open: true,
  options: [],
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function reassignShortcuts(options: LocalVoteOption[]) {
  options.forEach((o, i) => {
    o.shortcut = i < 9 ? String(i + 1) : null
  })
}

export function useLocalVote() {
  const state = useLocalStorage<LocalVoteState>('recuento-local-vote', () => ({
    ...DEFAULT_STATE,
  }))

  const totalVotes = computed(() => state.value.options.reduce((s, o) => s + o.count, 0))

  function addOption(label: string) {
    const idx = state.value.options.length
    state.value.options.push({
      id: makeId(),
      label,
      color: DEFAULT_OPTION_COLORS[idx % DEFAULT_OPTION_COLORS.length] ?? null,
      count: 0,
      shortcut: idx < 9 ? String(idx + 1) : null,
    })
  }

  function removeOption(id: string) {
    state.value.options = state.value.options.filter((o) => o.id !== id)
    reassignShortcuts(state.value.options)
  }

  function incrementOption(id: string) {
    const opt = state.value.options.find((o) => o.id === id)
    if (opt) opt.count++
  }

  function decrementOption(id: string) {
    const opt = state.value.options.find((o) => o.id === id)
    if (opt) opt.count = Math.max(0, opt.count - 1)
  }

  function setCount(id: string, count: number) {
    const opt = state.value.options.find((o) => o.id === id)
    if (opt) opt.count = Math.max(0, count)
  }

  function updateColor(id: string, color: string | null) {
    const opt = state.value.options.find((o) => o.id === id)
    if (opt) opt.color = color
  }

  function resetCounts() {
    state.value.options.forEach((o) => (o.count = 0))
  }

  function clearAll() {
    state.value = { ...DEFAULT_STATE, options: [] }
  }

  return {
    state,
    totalVotes,
    addOption,
    removeOption,
    incrementOption,
    decrementOption,
    setCount,
    updateColor,
    resetCounts,
    clearAll,
  }
}
