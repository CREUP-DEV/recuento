export function pickDefined<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  const entries = keys.flatMap((key) =>
    source[key] !== undefined ? [[key, source[key]] as const] : []
  )

  return Object.fromEntries(entries) as Partial<Pick<T, K>>
}
