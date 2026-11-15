import type { CsvCell, CsvFile, ExportLabels } from '../types/export.js'

const byteOrderMark = '\u{FEFF}'
const separator = ';'
const lineEnd = '\r\n'
const formulaStarts = ['=', '+', '-', '@', '\t', '\r']

export function formatCents(cents: number): string {
  const absolute = Math.abs(cents)
  const units = Math.floor(absolute / 100)
  const hundredths = String(absolute % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${units},${hundredths}`
}

export function neutralizeFormula(text: string): string {
  return formulaStarts.some((start) => text.startsWith(start))
    ? `'${text}`
    : text
}

function quote(field: string): string {
  return /[";\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

function renderCell(cell: CsvCell, labels: ExportLabels): string {
  if (cell === null) {
    return ''
  }
  if (typeof cell === 'boolean') {
    return cell ? labels.yes : labels.no
  }
  if (typeof cell === 'number') {
    return String(cell)
  }
  if (typeof cell === 'object') {
    return formatCents(cell.cents)
  }
  return quote(neutralizeFormula(cell))
}

export function renderCsv(file: CsvFile, labels: ExportLabels): Buffer {
  const lines = [
    file.headers.map(quote),
    ...file.rows.map((row) => row.map((cell) => renderCell(cell, labels))),
  ].map((fields) => fields.join(separator))
  return Buffer.from(`${byteOrderMark}${lines.join(lineEnd)}${lineEnd}`, 'utf8')
}
