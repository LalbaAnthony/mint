import type {
  AmountReading,
  CsvDateFormat,
  CsvMapping,
  DedupSource,
  InterpretedLine,
} from '../types/imports.js'
import { isoDate } from './dates.js'
import { normalizeBankLabel } from './labels.js'

const datePatterns: Record<CsvDateFormat, RegExp> = {
  'DD/MM/YYYY': /^(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})$/,
  'DD/MM/YY': /^(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{2})$/,
  'DD-MM-YYYY': /^(?<day>\d{1,2})-(?<month>\d{1,2})-(?<year>\d{4})$/,
  'DD.MM.YYYY': /^(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})$/,
  'YYYY-MM-DD': /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})$/,
  'MM/DD/YYYY': /^(?<month>\d{1,2})\/(?<day>\d{1,2})\/(?<year>\d{4})$/,
}

const amountPattern = /^(?<sign>[+-]?)(?<units>\d+)(?:\.(?<fraction>\d{1,2}))?$/

const ignoredAmountCharacters = /[\s  €]/g

export function parseCsvDate(
  text: string,
  format: CsvDateFormat,
): string | null {
  const groups = datePatterns[format].exec(text.trim())?.groups
  if (groups === undefined) {
    return null
  }
  const rawYear = Number(groups.year)
  const year = format === 'DD/MM/YY' ? 2000 + rawYear : rawYear
  try {
    return isoDate(year, Number(groups.month), Number(groups.day))
  } catch {
    return null
  }
}

export function parseCsvAmount(
  text: string,
  decimalSeparator: CsvMapping['decimalSeparator'],
): number | null {
  let compact = text.replace(ignoredAmountCharacters, '')
  if (compact.endsWith('-')) {
    compact = `-${compact.slice(0, -1)}`
  }
  const normalized =
    decimalSeparator === 'comma'
      ? compact.replaceAll('.', '').replace(',', '.')
      : compact.replaceAll(',', '')
  const groups = amountPattern.exec(normalized)?.groups
  if (groups === undefined) {
    return null
  }
  const cents =
    Number(groups.units) * 100 + Number((groups.fraction ?? '0').padEnd(2, '0'))
  return groups.sign === '-' ? -cents : cents
}

function cell(cells: readonly string[], column: number): string | undefined {
  return cells[column]
}

function readAmount(
  cells: readonly string[],
  mapping: CsvMapping,
): AmountReading {
  if (mapping.colAmount !== null) {
    const text = cell(cells, mapping.colAmount)
    if (text === undefined) {
      return { amountCents: null, error: 'missing_column' }
    }
    const amount = parseCsvAmount(text, mapping.decimalSeparator)
    if (amount === null) {
      return { amountCents: null, error: 'invalid_amount' }
    }
    return amount === 0
      ? { amountCents: null, error: 'amount_zero' }
      : { amountCents: amount, error: null }
  }
  const debitText = cell(cells, mapping.colDebit ?? -1)
  const creditText = cell(cells, mapping.colCredit ?? -1)
  if (debitText === undefined || creditText === undefined) {
    return { amountCents: null, error: 'missing_column' }
  }
  const debit =
    debitText.trim() === ''
      ? 0
      : parseCsvAmount(debitText, mapping.decimalSeparator)
  const credit =
    creditText.trim() === ''
      ? 0
      : parseCsvAmount(creditText, mapping.decimalSeparator)
  if (debit === null || credit === null) {
    return { amountCents: null, error: 'invalid_amount' }
  }
  if (debit !== 0 && credit !== 0) {
    return { amountCents: null, error: 'both_amounts' }
  }
  if (debit === 0 && credit === 0) {
    return { amountCents: null, error: 'amount_zero' }
  }
  return {
    amountCents: debit !== 0 ? -Math.abs(debit) : Math.abs(credit),
    error: null,
  }
}

export function dataRows(
  rows: readonly string[][],
  mapping: Pick<CsvMapping, 'skipTop' | 'skipBottom' | 'hasHeader'>,
): { rowIndex: number; cells: string[] }[] {
  const start = mapping.skipTop + (mapping.hasHeader ? 1 : 0)
  const end = rows.length - mapping.skipBottom
  const selected: { rowIndex: number; cells: string[] }[] = []
  for (let index = start; index < end; index += 1) {
    const cells = rows[index]
    if (cells !== undefined && cells.some((value) => value.trim() !== '')) {
      selected.push({ rowIndex: index, cells })
    }
  }
  return selected
}

export function interpretLine(
  rowIndex: number,
  cells: string[],
  mapping: CsvMapping,
): InterpretedLine {
  const dateText = cell(cells, mapping.colDate)
  const labelText = cell(cells, mapping.colLabel)
  if (dateText === undefined || labelText === undefined) {
    return {
      rowIndex,
      raw: cells,
      error: 'missing_column',
      date: null,
      amountCents: null,
      bankLabel: null,
    }
  }
  const date = parseCsvDate(dateText, mapping.dateFormat)
  const amount = readAmount(cells, mapping)
  const bankLabel = labelText.replace(/\s+/g, ' ').trim()
  const error =
    date === null
      ? 'invalid_date'
      : amount.error !== null
        ? amount.error
        : bankLabel === ''
          ? 'missing_label'
          : null
  if (error !== null || date === null || amount.amountCents === null) {
    return {
      rowIndex,
      raw: cells,
      error: error ?? 'invalid_amount',
      date,
      amountCents: amount.amountCents,
      bankLabel: bankLabel === '' ? null : bankLabel,
    }
  }
  return {
    rowIndex,
    raw: cells,
    error: null,
    date,
    amountCents: amount.amountCents,
    bankLabel,
  }
}

export function interpretRows(
  rows: readonly string[][],
  mapping: CsvMapping,
): InterpretedLine[] {
  return dataRows(rows, mapping).map(({ rowIndex, cells }) =>
    interpretLine(rowIndex, cells, mapping),
  )
}

export function dedupHashes(sources: readonly DedupSource[]): string[] {
  const ranks = new Map<string, number>()
  return sources.map((source) => {
    const label = normalizeBankLabel(source.bankLabel)
    const identity = `${source.date}|${source.amountCents}|${label}`
    const rank = (ranks.get(identity) ?? 0) + 1
    ranks.set(identity, rank)
    return `${source.date}|${source.amountCents}|${rank}|${label}`
  })
}
