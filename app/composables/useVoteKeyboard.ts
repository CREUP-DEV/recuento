export interface KeyboardShortcutOption {
  id: string
  shortcut: string | null
}

export function useVoteKeyboard(
  options: Ref<KeyboardShortcutOption[]>,
  onIncrement: (optionId: string) => void,
  isActive: Ref<boolean>,
  onDecrement: (optionId: string) => void
) {
  const flashingOptionId = ref<string | null>(null)
  const lastIncrementedId = ref<string | null>(null)
  let flashTimeout: ReturnType<typeof setTimeout> | null = null

  function handleKeydown(e: KeyboardEvent) {
    if (!isActive.value) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Backspace' && lastIncrementedId.value) {
      e.preventDefault()
      onDecrement(lastIncrementedId.value)
      flashingOptionId.value = lastIncrementedId.value
      if (flashTimeout) clearTimeout(flashTimeout)
      flashTimeout = setTimeout(() => {
        flashingOptionId.value = null
      }, 300)
      return
    }

    const option = options.value.find((o) => o.shortcut === e.key)
    if (!option) return

    e.preventDefault()
    onIncrement(option.id)
    lastIncrementedId.value = option.id

    flashingOptionId.value = option.id
    if (flashTimeout) clearTimeout(flashTimeout)
    flashTimeout = setTimeout(() => {
      flashingOptionId.value = null
    }, 300)
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    if (flashTimeout) clearTimeout(flashTimeout)
  })

  return { flashingOptionId }
}
