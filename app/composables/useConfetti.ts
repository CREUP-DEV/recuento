export function useConfetti() {
  async function launchConfetti() {
    if (import.meta.server) return
    const { default: confetti } = await import('canvas-confetti')
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 } })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5, x: 0.15 } }), 200)
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5, x: 0.85 } }), 350)
  }

  return { launchConfetti }
}
