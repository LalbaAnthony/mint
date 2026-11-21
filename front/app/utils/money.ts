import type {
  DecimalInputRules,
  DecimalReading,
  NumberInputSymbols,
  SignedDecimalReading,
} from '~~/types/number-input'

export const maskedAmountGlyph = '****'

const amountFractionDigits = 2
const placeholderCents = 123_456

const ignoredCharacters = /[\s€]/g
const digitsPattern = /^\d+$/
const leadingGroupPattern = /^[1-9]\d{0,2}$/
const groupPattern = /^\d{3}$/

const amountRules: DecimalInputRules = {
  maxFractionDigits: amountFractionDigits,
  grouping: true,
}

const rateRules: DecimalInputRules = {
  maxFractionDigits: null,
  grouping: false,
}

function inputSymbols(locale: string): NumberInputSymbols {
  const parts = new Intl.NumberFormat(locale).formatToParts(1_234_567.8)
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  const group = parts.find((part) => part.type === 'group')?.value ?? ''
  const other = decimal === ',' ? '.' : ','
  const typableGroup = group === ',' || group === '.'
  return {
    decimal,
    other,
    group: typableGroup ? group : other,
    standaloneGroups: typableGroup,
  }
}

function splitOnce(text: string, separator: string): [string, string] | null {
  const index = text.indexOf(separator)
  if (index === -1 || index !== text.lastIndexOf(separator)) {
    return null
  }
  return [text.slice(0, index), text.slice(index + 1)]
}

function groupedDigits(text: string, group: string | null): string | null {
  if (digitsPattern.test(text)) {
    return text
  }
  if (group === null) {
    return null
  }
  const [head = '', ...tail] = text.split(group)
  const grouped =
    leadingGroupPattern.test(head) &&
    tail.length > 0 &&
    tail.every((part) => groupPattern.test(part))
  return grouped ? [head, ...tail].join('') : null
}

function isFraction(text: string, maxDigits: number | null): boolean {
  return (
    digitsPattern.test(text) && (maxDigits === null || text.length <= maxDigits)
  )
}

function readDecimal(
  text: string,
  symbols: NumberInputSymbols,
  rules: DecimalInputRules,
): DecimalReading | null {
  const group = rules.grouping ? symbols.group : null
  if (text.includes(symbols.decimal)) {
    const parts = splitOnce(text, symbols.decimal)
    if (parts === null || !isFraction(parts[1], rules.maxFractionDigits)) {
      return null
    }
    const units = groupedDigits(parts[0], group)
    return units === null ? null : { units, fraction: parts[1] }
  }
  const parts = splitOnce(text, symbols.other)
  if (
    parts !== null &&
    digitsPattern.test(parts[0]) &&
    isFraction(parts[1], rules.maxFractionDigits)
  ) {
    return { units: parts[0], fraction: parts[1] }
  }
  const units = groupedDigits(text, symbols.standaloneGroups ? group : null)
  return units === null ? null : { units, fraction: '' }
}

function readSigned(
  text: string,
  locale: string,
  rules: DecimalInputRules,
): SignedDecimalReading | null {
  const compact = text.replace(ignoredCharacters, '')
  const sign = compact.charAt(0)
  const negative = sign === '-' || sign === '−'
  const unsigned = negative || sign === '+' ? compact.slice(1) : compact
  const reading = readDecimal(unsigned, inputSymbols(locale), rules)
  return reading === null ? null : { negative, reading }
}

export function parseAmountInput(text: string, locale: string): number | null {
  const signed = readSigned(text, locale, amountRules)
  if (signed === null) {
    return null
  }
  const { units, fraction } = signed.reading
  const cents =
    Number(units) * 100 + Number(fraction.padEnd(amountFractionDigits, '0'))
  return signed.negative && cents !== 0 ? -cents : cents
}

export function parseRateInput(text: string, locale: string): number | null {
  const signed = readSigned(text, locale, rateRules)
  if (signed === null) {
    return null
  }
  const { units, fraction } = signed.reading
  const rate = Number(fraction === '' ? units : `${units}.${fraction}`)
  return signed.negative && rate !== 0 ? -rate : rate
}

export function formatAmountInput(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: amountFractionDigits,
    maximumFractionDigits: amountFractionDigits,
  }).format(cents / 100)
}

export function formatRateInput(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(rate)
}

export function amountInputPlaceholder(locale: string): string {
  return formatAmountInput(placeholderCents, locale)
}
