const combiningMarks = /[̀-ͯ]/g
const whitespace = /\s+/g
const datePattern = /\b\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?\b/g
const digits = /\d+/g
const wordSeparators = /[^a-z0-9]+/

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(combiningMarks, '')
}

export function normalizeBankLabel(label: string): string {
  return stripAccents(label).toUpperCase().replace(whitespace, ' ').trim()
}

export function foldForMatching(text: string): string {
  return stripAccents(text).toLowerCase().replace(whitespace, ' ').trim()
}

export function rulePatternFromBankLabel(bankLabel: string): string {
  return normalizeBankLabel(
    normalizeBankLabel(bankLabel)
      .replace(datePattern, ' ')
      .replace(digits, ' '),
  )
}

export function labelWords(text: string): string[] {
  return foldForMatching(text)
    .split(wordSeparators)
    .filter((word) => word.length > 1)
}

export function diceSimilarity(first: string, second: string): number {
  const left = new Set(labelWords(first))
  const right = new Set(labelWords(second))
  if (left.size === 0 || right.size === 0) {
    return 0
  }
  let common = 0
  for (const word of left) {
    if (right.has(word)) {
      common += 1
    }
  }
  return (2 * common) / (left.size + right.size)
}
