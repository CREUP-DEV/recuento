/**
 * Returns up to 2 uppercase initials from a name or email string.
 * Examples:
 *   "María García" → "MG"
 *   "admin@creup.es" → "AD"
 *   "Juan" → "JU"
 */
export function getInitials(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return '?'

  // If it looks like an email, use the first 2 chars of the local part
  if (trimmed.includes('@')) {
    const [localPart = ''] = trimmed.split('@')
    return localPart.slice(0, 2).toUpperCase() || '?'
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0]?.slice(0, 2).toUpperCase() || '?'
  }

  const firstInitial = words[0]?.[0] ?? ''
  const secondInitial = words[1]?.[0] ?? ''
  return (firstInitial + secondInitial).toUpperCase() || '?'
}
