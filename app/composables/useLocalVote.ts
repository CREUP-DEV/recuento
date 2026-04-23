import { useLocalStorage } from '@vueuse/core'
import { DEFAULT_OPTION_COLORS, getVoteShortcut } from '~~/shared/constants/voteOptions'

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
  history: string[]
  redoHistory: string[]
}

const DEFAULT_STATE: LocalVoteState = {
  name: 'Votación temporal',
  open: false,
  options: [],
  history: [],
  redoHistory: [],
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function reassignShortcuts(options: LocalVoteOption[]) {
  options.forEach((o, i) => {
    o.shortcut = getVoteShortcut(i)
  })
}

function normalizeState(value: Partial<LocalVoteState> | null | undefined): LocalVoteState {
  const options = Array.isArray(value?.options) ? value.options : []
  reassignShortcuts(options)
  const optionIds = new Set(options.map((option) => option.id))
  const history = Array.isArray(value?.history)
    ? value.history.filter((optionId): optionId is string => optionIds.has(optionId))
    : []
  const redoHistory = Array.isArray(value?.redoHistory)
    ? value.redoHistory.filter((optionId): optionId is string => optionIds.has(optionId))
    : []

  return {
    name: value?.name && value.name !== 'Votación local' ? value.name : DEFAULT_STATE.name,
    open: typeof value?.open === 'boolean' ? value.open : DEFAULT_STATE.open,
    options,
    history,
    redoHistory,
  }
}

function removeLastHistoryEntry(history: string[], optionId: string) {
  const index = history.lastIndexOf(optionId)

  if (index === -1) {
    return false
  }

  history.splice(index, 1)

  return true
}

export function useLocalVote() {
  const state = useLocalStorage<LocalVoteState>('recuento-local-vote', () => ({
    ...DEFAULT_STATE,
  }))
  state.value = normalizeState(state.value)

  const totalVotes = computed(() => state.value.options.reduce((s, o) => s + o.count, 0))
  const canUndo = computed(() => state.value.history.length > 0)
  const canRedo = computed(() => state.value.redoHistory.length > 0)

  function addOption(label: string) {
    const idx = state.value.options.length
    state.value.redoHistory = []
    state.value.options.push({
      id: makeId(),
      label,
      color: DEFAULT_OPTION_COLORS[idx % DEFAULT_OPTION_COLORS.length] ?? null,
      count: 0,
      shortcut: getVoteShortcut(idx),
    })
  }

  function removeOption(id: string) {
    state.value.options = state.value.options.filter((o) => o.id !== id)
    state.value.history = state.value.history.filter((optionId) => optionId !== id)
    state.value.redoHistory = state.value.redoHistory.filter((optionId) => optionId !== id)
    reassignShortcuts(state.value.options)
  }

  function incrementOption(id: string) {
    if (!state.value.open) return

    const opt = state.value.options.find((o) => o.id === id)
    if (!opt) return

    opt.count++
    state.value.history.push(id)
    state.value.redoHistory = []
  }

  function decrementOption(id: string) {
    if (!state.value.open) return

    const opt = state.value.options.find((o) => o.id === id)
    if (!opt || opt.count <= 0) return

    opt.count = Math.max(0, opt.count - 1)
    removeLastHistoryEntry(state.value.history, id)
    state.value.redoHistory = []
  }

  function setCount(id: string, count: number) {
    if (!state.value.open) return

    const opt = state.value.options.find((o) => o.id === id)
    if (!opt) return

    opt.count = Math.max(0, count)
    state.value.history = []
    state.value.redoHistory = []
  }

  function updateColor(id: string, color: string | null) {
    const opt = state.value.options.find((o) => o.id === id)
    if (opt) opt.color = color
  }

  function resetCounts() {
    state.value.options.forEach((o) => (o.count = 0))
    state.value.history = []
    state.value.redoHistory = []
  }

  function clearAll() {
    state.value = { ...DEFAULT_STATE, options: [], history: [], redoHistory: [] }
  }

  function undoLastVote() {
    if (!state.value.open) {
      return null
    }

    while (state.value.history.length > 0) {
      const optionId = state.value.history.pop()

      if (!optionId) {
        break
      }

      const option = state.value.options.find((entry) => entry.id === optionId)

      if (!option || option.count <= 0) {
        continue
      }

      option.count--
      state.value.redoHistory.push(optionId)

      return optionId
    }

    return null
  }

  function redoLastVote() {
    if (!state.value.open) {
      return null
    }

    while (state.value.redoHistory.length > 0) {
      const optionId = state.value.redoHistory.pop()

      if (!optionId) {
        break
      }

      const option = state.value.options.find((entry) => entry.id === optionId)

      if (!option) {
        continue
      }

      option.count++
      state.value.history.push(optionId)

      return optionId
    }

    return null
  }

  return {
    state,
    totalVotes,
    canUndo,
    canRedo,
    addOption,
    removeOption,
    incrementOption,
    decrementOption,
    setCount,
    updateColor,
    resetCounts,
    clearAll,
    undoLastVote,
    redoLastVote,
  }
}
