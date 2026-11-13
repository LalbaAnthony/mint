export function useFormatters() {
  const { locale } = useI18n()

  function formatDateTime(value: string | null): string {
    if (value === null) {
      return ''
    }
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    }).format(new Date(value))
  }

  return { formatDateTime }
}
