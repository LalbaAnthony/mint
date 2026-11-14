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

  function formatDate(isoDate: string): string {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(`${isoDate}T00:00:00Z`))
  }

  function formatMoney(
    cents: number,
    signDisplay: 'auto' | 'exceptZero' = 'auto',
  ): string {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'EUR',
      signDisplay,
    }).format(cents / 100)
  }

  return { formatDateTime, formatDate, formatMoney }
}
