export const DEFAULT_LOCALE_CODE = 'es'
export const SUPPORTED_LOCALE_CODES = ['es', 'en'] as const

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number]
