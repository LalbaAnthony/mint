export function formatPercent(
  value: number,
  locale: string,
  signDisplay: 'auto' | 'exceptZero' = 'auto',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay,
  }).format(value / 100)
}
