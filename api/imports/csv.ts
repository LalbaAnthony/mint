import { parse } from 'csv-parse/sync'
import iconv from 'iconv-lite'
import type { CsvMapping } from '@mint/shared/types/imports'

const delimiterCharacters: Record<CsvMapping['delimiter'], string> = {
  semicolon: ';',
  comma: ',',
  tab: '\t',
}

export const sampleLineCount = 15

function isValidUtf8(bytes: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

export function decodeFile(
  bytes: Buffer,
  encoding: CsvMapping['encoding'],
): string {
  const text = iconv.decode(bytes, encoding)
  return text.startsWith('﻿') ? text.slice(1) : text
}

export function readRows(
  text: string,
  delimiter: CsvMapping['delimiter'],
): string[][] {
  const records: unknown = parse(text, {
    delimiter: delimiterCharacters[delimiter],
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: false,
    bom: true,
  })
  if (!Array.isArray(records)) {
    return []
  }
  return records.map((record: unknown) =>
    Array.isArray(record)
      ? record.map((value: unknown) => (typeof value === 'string' ? value : ''))
      : [],
  )
}

export function readFileRows(bytes: Buffer, mapping: CsvMapping): string[][] {
  return readRows(decodeFile(bytes, mapping.encoding), mapping.delimiter)
}

function guessDelimiter(firstLine: string): CsvMapping['delimiter'] {
  const semicolons = firstLine.split(';').length
  const commas = firstLine.split(',').length
  const tabs = firstLine.split('\t').length
  if (tabs > semicolons && tabs > commas) {
    return 'tab'
  }
  return commas > semicolons ? 'comma' : 'semicolon'
}

export function guessMapping(bytes: Buffer): CsvMapping {
  const encoding = isValidUtf8(bytes) ? 'utf-8' : 'windows-1252'
  const text = decodeFile(bytes, encoding)
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = guessDelimiter(firstLine)
  return {
    delimiter,
    encoding,
    hasHeader: true,
    skipTop: 0,
    skipBottom: 0,
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: delimiter === 'comma' ? 'dot' : 'comma',
    colDate: 0,
    colLabel: 1,
    colAmount: 2,
    colDebit: null,
    colCredit: null,
  }
}
