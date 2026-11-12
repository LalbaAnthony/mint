import { describe, expect, it } from 'vitest'
import {
  extractCommitMessage,
  findForbiddenCharacters,
  findForbiddenContent,
  findPaletteClasses,
  formatFinding,
  isBinary,
  isPaletteCheckedPath,
} from './forbidden-content.ts'

const emDash = '\u{2014}'
const grinningFace = '\u{1F600}'
const regionalIndicatorF = '\u{1F1EB}'
const variationSelector16 = '\u{FE0F}'
const combiningKeycap = '\u{20E3}'

describe('findForbiddenCharacters', () => {
  it('locates an em dash by line and column', () => {
    const findings = findForbiddenCharacters(`first line\nab${emDash}cd`)

    expect(findings).toEqual([
      {
        line: 2,
        column: 3,
        description: 'forbidden character U+2014 (CODE-06, CODE-07)',
      },
    ])
  })

  it.each([
    ['a pictographic emoji', grinningFace, 'U+1F600'],
    ['a regional indicator', regionalIndicatorF, 'U+1F1EB'],
    ['an emoji variation selector', variationSelector16, 'U+FE0F'],
    ['a combining keycap', combiningKeycap, 'U+20E3'],
  ])('flags %s', (_label, character, codePointLabel) => {
    const findings = findForbiddenCharacters(`x${character}x`)

    expect(findings.map((finding) => finding.description)).toEqual([
      `forbidden character ${codePointLabel} (CODE-06, CODE-07)`,
    ])
  })

  it('accepts the typography used in the documentation', () => {
    const frenchTypography = [
      '\u{AB}',
      '\u{BB}',
      '\u{B7}',
      '\u{202F}',
      '\u{20AC}',
      '\u{2212}',
      '\u{2265}',
      '\u{2264}',
      '\u{2248}',
      '\u{221A}',
      '\u{B1}',
      '\u{D7}',
      '\u{2026}',
      '\u{2013}',
      '\u{B0}',
    ].join(' ')

    expect(findForbiddenCharacters(frenchTypography)).toEqual([])
  })

  it('reports every occurrence', () => {
    expect(findForbiddenCharacters(`${emDash}${emDash}\n${emDash}`)).toEqual([
      expect.objectContaining({ line: 1, column: 1 }),
      expect.objectContaining({ line: 1, column: 2 }),
      expect.objectContaining({ line: 2, column: 1 }),
    ])
  })
})

describe('findPaletteClasses', () => {
  it.each([
    'text-blue-600',
    'bg-coral-400',
    'hover:bg-mint-800',
    'bg-olive-50/50',
    'border-x-mist-300',
    'ring-offset-red-500',
    'inset-shadow-teal-950',
    'lg:dark:text-violet-400!',
  ])('flags %s', (className) => {
    const findings = findPaletteClasses(`<div class="p-4 ${className}">`)

    expect(findings).toHaveLength(1)
    expect(findings[0]?.description).toContain('(CHG-104)')
  })

  it.each([
    'text-primary',
    'bg-primary/10',
    'bg-accent-fill',
    'text-accent-on-fill',
    'bg-data-needs',
    'hover:bg-(--app-primary-hover)',
    'var(--ui-color-primary-700)',
    'max-w-2xl',
    'size-5',
    'blue-600',
  ])('accepts %s', (className) => {
    expect(findPaletteClasses(`<div class="${className}">`)).toEqual([])
  })
})

describe('isPaletteCheckedPath', () => {
  it.each([
    ['front/app/app.vue', true],
    ['front/app/components/MoneyAmount.vue', true],
    ['front/app/charts/theme.ts', true],
    ['front/app/assets/css/main.css', false],
    ['front/types/money-amount.ts', false],
    ['front/nuxt.config.ts', false],
    ['api/app/index.ts', false],
  ])('%s is checked: %s', (path, expected) => {
    expect(isPaletteCheckedPath(path)).toBe(expected)
  })
})

describe('findForbiddenContent', () => {
  it('rejects text-blue-600 in a Vue file under front/app (CA-10)', () => {
    const findings = findForbiddenContent(
      'front/app/pages/index.vue',
      '<template><p class="text-blue-600">x</p></template>',
    )

    expect(findings.map((finding) => finding.description)).toEqual([
      'raw palette class text-blue-600 (CHG-104)',
    ])
  })

  it('rejects text-blue-600 in a TypeScript file under front/app (CA-10)', () => {
    const findings = findForbiddenContent(
      'front/app/composables/use-tone.ts',
      "export const tone = 'text-blue-600'",
    )

    expect(findings).toHaveLength(1)
  })

  it('ignores palette classes outside front/app', () => {
    expect(
      findForbiddenContent('docs/graphic-charter.md', 'text-blue-600'),
    ).toEqual([])
  })

  it('checks forbidden characters in every path', () => {
    expect(findForbiddenContent('api/index.ts', emDash)).toHaveLength(1)
  })
})

describe('isBinary', () => {
  it('detects a NUL byte', () => {
    expect(isBinary(Uint8Array.from([0x89, 0x50, 0x00, 0x47]))).toBe(true)
  })

  it('treats UTF-8 text as text', () => {
    expect(isBinary(new TextEncoder().encode(`texte ${emDash}`))).toBe(false)
  })
})

describe('extractCommitMessage', () => {
  it('drops comment lines and everything below the scissors line', () => {
    const rawMessage = [
      'feat: add accounts',
      '',
      '# Please enter the commit message',
      'Body line',
      '# ------------------------ >8 ------------------------',
      `diff with ${emDash}`,
    ].join('\n')

    expect(extractCommitMessage(rawMessage)).toBe(
      'feat: add accounts\n\nBody line\n',
    )
  })
})

describe('formatFinding', () => {
  it('formats a location, a position and a description', () => {
    expect(
      formatFinding('docs/a.md', { line: 3, column: 7, description: 'x' }),
    ).toBe('docs/a.md:3:7 x')
  })
})
