const amountPattern = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/

const ignoredCharacters = /[\s  ]/g

export function parseAmountInput(text: string): number | null {
  const normalized = text.replace(ignoredCharacters, '').replace('−', '-')
  const match = amountPattern.exec(normalized)
  if (match === null) {
    return null
  }
  const sign = match[1] ?? ''
  const units = match[2] ?? '0'
  const decimals = (match[3] ?? '').padEnd(2, '0')
  const cents = Number(units) * 100 + Number(decimals)
  return sign === '-' ? -cents : cents
}

export function formatAmountInput(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100)
}
