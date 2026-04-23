export interface KeyboardShortcutOption {
  id: string
  shortcut: string | null
}

export function useVoteKeyboard(
  options: Ref<KeyboardShortcutOption[]>,
  onIncrement: (optionId: string) => void,
  isActive: Ref<boolean>,
  onUndo?: () => string | null,
  onRedo?: () => string | null
) {
  const flashingOptionId = ref<string | null>(null)
  let flashTimeout: ReturnType<typeof setTimeout> | null = null

  function flashOption(optionId: string) {
    flashingOptionId.value = optionId

    if (flashTimeout) clearTimeout(flashTimeout)

    flashTimeout = setTimeout(() => {
      flashingOptionId.value = null
    }, 300)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isActive.value) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Backspace' && e.shiftKey && onRedo) {
      e.preventDefault()

      const optionId = onRedo()

      if (optionId) {
        flashOption(optionId)
      }

      return
    }

    if (e.key === 'Backspace' && onUndo) {
      e.preventDefault()

      const optionId = onUndo()

      if (optionId) {
        flashOption(optionId)
      }

      return
    }

    const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key
    const option = options.value.find((o) => o.shortcut === pressedKey)
    if (!option) return

    e.preventDefault()
    onIncrement(option.id)
    flashOption(option.id)
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    if (flashTimeout) clearTimeout(flashTimeout)
  })

  return { flashingOptionId, flashOption }
}
