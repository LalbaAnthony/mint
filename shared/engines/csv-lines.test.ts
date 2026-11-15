import { describe, expect, it } from 'vitest'
import type { CsvMapping } from '../types/imports.js'
import {
  dataRows,
  dedupHashes,
  interpretLine,
  interpretRows,
  parseCsvAmount,
  parseCsvDate,
} from './csv-lines.js'

const splitMapping: CsvMapping = {
  delimiter: 'semicolon',
  encoding: 'windows-1252',
  hasHeader: true,
  skipTop: 1,
  skipBottom: 1,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: 'comma',
  colDate: 0,
  colLabel: 1,
  colAmount: null,
  colDebit: 2,
  colCredit: 3,
}

const signedMapping: CsvMapping = {
  ...splitMapping,
  hasHeader: false,
  skipTop: 0,
  skipBottom: 0,
  dateFormat: 'YYYY-MM-DD',
  decimalSeparator: 'dot',
  colAmount: 2,
  colDebit: null,
  colCredit: null,
}

describe('parseCsvDate (IMP-02)', () => {
  it.each([
    ['07/12/2026', 'DD/MM/YYYY', '2026-12-07'],
    ['7/12/26', 'DD/MM/YY', '2026-12-07'],
    ['07-12-2026', 'DD-MM-YYYY', '2026-12-07'],
    ['07.12.2026', 'DD.MM.YYYY', '2026-12-07'],
    ['2026-12-07', 'YYYY-MM-DD', '2026-12-07'],
    ['12/07/2026', 'MM/DD/YYYY', '2026-12-07'],
  ] as const)('reads %s as %s', (text, format, expected) => {
    expect(parseCsvDate(text, format)).toBe(expected)
  })

  it('refuses a date of another format or that does not exist', () => {
    expect(parseCsvDate('2026-12-07', 'DD/MM/YYYY')).toBeNull()
    expect(parseCsvDate('31/02/2026', 'DD/MM/YYYY')).toBeNull()
  })
})

describe('parseCsvAmount (IMP-02)', () => {
  it.each([
    ['+187,00', 'comma', 18_700],
    ['-1 234,5', 'comma', -123_450],
    ['1.234,56 €', 'comma', 123_456],
    ['44,16-', 'comma', -4_416],
    ['1,234.56', 'dot', 123_456],
    ['-0.5', 'dot', -50],
    ['12', 'dot', 1_200],
  ] as const)(
    'reads %s with a %s decimal separator',
    (text, separator, cents) => {
      expect(parseCsvAmount(text, separator)).toBe(cents)
    },
  )

  it('refuses text and more than two decimals', () => {
    expect(parseCsvAmount('abc', 'comma')).toBeNull()
    expect(parseCsvAmount('1,234', 'dot')).toBe(123_400)
    expect(parseCsvAmount('1.234', 'dot')).toBeNull()
  })
})

describe('interpretRows (IMP-02, IMP-04)', () => {
  const rows = [
    ['Relevé du compte'],
    ['Date', 'Libellé', 'Débit', 'Crédit'],
    ['07/12/2026', 'VIR PRESTATION', '', '187,00'],
    ['08/12/2026', '  CB   BOULANGERIE ', '4,50', ''],
    ['', '', '', ''],
    ['09/13/2026', 'CB X', '1,00', ''],
    ['10/12/2026', 'CB Y', '1,00', '2,00'],
    ['11/12/2026', 'CB Z', '', ''],
    ['12/12/2026', '', '1,00', ''],
    ['13/12/2026', 'CB W', 'abc', ''],
    ['14/12/2026'],
    ['Solde final', '', '', ''],
  ]

  it('skips the leading, header, empty and trailing lines', () => {
    expect(dataRows(rows, splitMapping).map((row) => row.rowIndex)).toEqual([
      2, 3, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('reads debit and credit columns and reports each faulty line with its reason', () => {
    expect(
      interpretRows(rows, splitMapping).map((line) => [
        line.rowIndex,
        line.error,
        line.date,
        line.amountCents,
        line.bankLabel,
      ]),
    ).toEqual([
      [2, null, '2026-12-07', 18_700, 'VIR PRESTATION'],
      [3, null, '2026-12-08', -450, 'CB BOULANGERIE'],
      [5, 'invalid_date', null, -100, 'CB X'],
      [6, 'both_amounts', '2026-12-10', null, 'CB Y'],
      [7, 'amount_zero', '2026-12-11', null, 'CB Z'],
      [8, 'missing_label', '2026-12-12', -100, null],
      [9, 'invalid_amount', '2026-12-13', null, 'CB W'],
      [10, 'missing_column', null, null, null],
    ])
  })

  it('reads a single signed amount column', () => {
    expect(
      interpretLine(0, ['2026-12-05', 'VIR', '-200.00'], signedMapping),
    ).toMatchObject({ error: null, amountCents: -20_000 })
    expect(
      interpretLine(0, ['2026-12-05', 'VIR', '0'], signedMapping),
    ).toMatchObject({ error: 'amount_zero' })
    expect(
      interpretLine(0, ['2026-12-05', 'VIR', 'x'], signedMapping),
    ).toMatchObject({ error: 'invalid_amount' })
    expect(
      interpretLine(0, ['2026-12-05', 'VIR'], signedMapping),
    ).toMatchObject({ error: 'missing_column' })
    expect(
      interpretLine(0, ['2026-12-05', 'VIR', '1'], {
        ...splitMapping,
        dateFormat: 'YYYY-MM-DD',
      }),
    ).toMatchObject({ error: 'missing_column' })
  })
})

describe('dedupHashes (IMP-05)', () => {
  it('ranks identical lines of the same day and ignores case, accents and spaces', () => {
    expect(
      dedupHashes([
        { date: '2026-12-07', amountCents: -450, bankLabel: 'CB Boulangerie' },
        { date: '2026-12-07', amountCents: -450, bankLabel: 'CB  BOULANGERIE' },
        { date: '2026-12-08', amountCents: -450, bankLabel: 'CB Boulangerie' },
        { date: '2026-12-07', amountCents: -450, bankLabel: 'CB Pâtisserie' },
      ]),
    ).toEqual([
      '2026-12-07|-450|1|CB BOULANGERIE',
      '2026-12-07|-450|2|CB BOULANGERIE',
      '2026-12-08|-450|1|CB BOULANGERIE',
      '2026-12-07|-450|1|CB PATISSERIE',
    ])
  })
})
