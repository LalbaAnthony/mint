const forbiddenCharacterPattern =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}\u{2014}]/gu

const paletteNames = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'taupe',
  'mauve',
  'mist',
  'olive',
  'mint',
  'coral',
]

const shadeSteps = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
]

const paletteClassPattern = new RegExp(
  `(?<![\\w-])(?:[a-z][a-z0-9]*-)+(?:${paletteNames.join('|')})-(?:${shadeSteps.join('|')})(?![\\w-])`,
  'g',
)

const paletteCheckedPathPattern = /^front\/app\/.+\.(?:vue|ts)$/

const characterUncheckedPaths = new Set(['package-lock.json'])

const binarySniffLength = 8000

const commitMessageScissorsPattern = /^# -+ >8 -+$/m

export function isBinary(content: Uint8Array): boolean {
  return content.subarray(0, binarySniffLength).includes(0)
}

export function isPaletteCheckedPath(path: string): boolean {
  return paletteCheckedPathPattern.test(path)
}

export function isCharacterCheckedPath(path: string): boolean {
  return !characterUncheckedPaths.has(path)
}

function locate(text: string, index: number) {
  let line = 1
  let lineStart = 0
  let newline = text.indexOf('\n')
  while (newline !== -1 && newline < index) {
    line += 1
    lineStart = newline + 1
    newline = text.indexOf('\n', lineStart)
  }
  return { line, column: index - lineStart + 1 }
}

function toCodePointLabel(character: string): string {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) {
    throw new Error('Cannot label an empty match')
  }
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
}

export function findForbiddenCharacters(text: string) {
  return Array.from(text.matchAll(forbiddenCharacterPattern), (match) => ({
    ...locate(text, match.index),
    description: `forbidden character ${toCodePointLabel(match[0])} (CODE-06, CODE-07)`,
  }))
}

export function findPaletteClasses(text: string) {
  return Array.from(text.matchAll(paletteClassPattern), (match) => ({
    ...locate(text, match.index),
    description: `raw palette class ${match[0]} (CHG-104)`,
  }))
}

export function findForbiddenContent(path: string, text: string) {
  const findings = isCharacterCheckedPath(path)
    ? findForbiddenCharacters(text)
    : []
  if (isPaletteCheckedPath(path)) {
    findings.push(...findPaletteClasses(text))
  }
  return findings
}

export function extractCommitMessage(rawMessage: string): string {
  const scissorsIndex = rawMessage.search(commitMessageScissorsPattern)
  const keptMessage =
    scissorsIndex === -1 ? rawMessage : rawMessage.slice(0, scissorsIndex)
  return keptMessage
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
}

export function formatFinding(
  location: string,
  finding: { line: number; column: number; description: string },
): string {
  return `${location}:${finding.line}:${finding.column} ${finding.description}`
}
