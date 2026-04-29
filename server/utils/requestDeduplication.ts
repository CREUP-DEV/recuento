const WINDOW_MS = 5 * 60 * 1000
const MAX_PER_VOTE = 500

const store = new Map<string, Map<string, number>>()

export function isDuplicateRequest(voteId: string, nonce: string): boolean {
  const now = Date.now()
  let voteNonces = store.get(voteId)
  if (!voteNonces) {
    voteNonces = new Map()
    store.set(voteId, voteNonces)
  }

  for (const [n, ts] of voteNonces) {
    if (now - ts > WINDOW_MS) voteNonces.delete(n)
  }

  if (voteNonces.has(nonce)) return true

  if (voteNonces.size >= MAX_PER_VOTE) {
    const oldest = voteNonces.keys().next().value
    if (oldest) voteNonces.delete(oldest)
  }

  voteNonces.set(nonce, now)
  return false
}
