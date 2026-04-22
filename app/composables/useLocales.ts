export function useLocales() {
  const { locale, availableLocales: rawLocales } = useI18n()

  const availableLocales = computed(() => rawLocales as string[])

  const languageTags: Record<string, string> = {
    es: 'es-ES',
    en: 'en-GB',
  }

  const localeNames: Record<string, string> = {
    es: 'Español',
    en: 'English',
  }

  const localeFlags: Record<string, string> = {
    es: 'i-circle-flags-es',
    en: 'i-circle-flags-gb',
  }

  const getLanguageTag = (code?: string) => languageTags[code ?? locale.value] ?? 'es-ES'
  const getLocaleName = (code: string) => localeNames[code] ?? code.toUpperCase()
  const getLocaleFlag = (code: string) => localeFlags[code] ?? 'i-tabler-world'

  return { availableLocales, getLanguageTag, getLocaleName, getLocaleFlag }
}
