export function useLocaleFormatting() {
  const { localeProperties } = useI18n()

  function bcp47() {
    return localeProperties.value.language ?? localeProperties.value.code
  }

  function formatDate(dateStr: string) {
    try {
      return new Intl.DateTimeFormat(bcp47(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  function formatDateShort(dateStr: string) {
    try {
      return new Intl.DateTimeFormat(bcp47(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  function formatDateTime(dateStr: string) {
    try {
      return new Intl.DateTimeFormat(bcp47(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat(bcp47()).format(num)
  }

  return {
    formatDate,
    formatDateShort,
    formatDateTime,
    formatNumber,
  }
}
