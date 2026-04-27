export function useListFlipAnimation() {
  const listContainerRef = ref<HTMLElement | null>(null)

  function getOptionElements() {
    return Array.from(
      listContainerRef.value?.querySelectorAll<HTMLElement>('[data-option-id]') ?? []
    )
  }

  function cancelRunningAnimations() {
    for (const element of getOptionElements()) {
      for (const animation of element.getAnimations()) {
        animation.cancel()
      }
    }
  }

  function capturePositions() {
    return new Map(
      getOptionElements()
        .map((element) => {
          const optionId = element.dataset.optionId

          if (!optionId) {
            return null
          }

          return [optionId, element.getBoundingClientRect()] as const
        })
        .filter((entry): entry is readonly [string, DOMRect] => entry !== null)
    )
  }

  async function animateLayoutChange(mutate: () => void | Promise<void>) {
    cancelRunningAnimations()
    const before = capturePositions()

    await mutate()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    for (const element of getOptionElements()) {
      const optionId = element.dataset.optionId

      if (!optionId) {
        continue
      }

      const previousRect = before.get(optionId)

      if (!previousRect) {
        continue
      }

      const currentRect = element.getBoundingClientRect()
      const deltaY = previousRect.top - currentRect.top

      if (Math.abs(deltaY) < 1) {
        continue
      }

      element.animate([{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }], {
        duration: 220,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      })
    }
  }

  return {
    listContainerRef,
    animateLayoutChange,
  }
}
