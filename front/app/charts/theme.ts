import type { ChartTheme, ChartToken } from '~~/types/forecast'

const tokenVariables = {
  needs: '--data-group-needs',
  wants: '--data-group-wants',
  save: '--data-group-save',
  balance: '--data-balance',
  investment: '--data-usage-investment',
  threshold: '--data-threshold',
  negative: '--data-negative',
  income: '--data-income',
  expense: '--data-expense',
  net: '--data-net',
  textMuted: '--ui-text-muted',
  borderMuted: '--ui-border-muted',
  border: '--ui-border',
  background: '--ui-bg',
  text: '--ui-text',
} as const satisfies Record<ChartToken, string>

const fallbackColor = '#000000'

function hexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

export function toSrgbHex(color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null || color === '') {
    return color === '' ? fallbackColor : color
  }
  context.fillStyle = fallbackColor
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data
  return `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`
}

export function readChartTheme(root: HTMLElement): ChartTheme {
  const style = getComputedStyle(root)
  const color = (token: ChartToken) =>
    toSrgbHex(style.getPropertyValue(tokenVariables[token]).trim())
  const shades = (group: 'needs' | 'wants') =>
    Array.from({ length: 8 }, (_, index) =>
      toSrgbHex(style.getPropertyValue(`--data-${group}-${index + 1}`).trim()),
    )
  return {
    needs: color('needs'),
    wants: color('wants'),
    save: color('save'),
    needsShades: shades('needs'),
    wantsShades: shades('wants'),
    balance: color('balance'),
    investment: color('investment'),
    threshold: color('threshold'),
    negative: color('negative'),
    income: color('income'),
    expense: color('expense'),
    net: color('net'),
    textMuted: color('textMuted'),
    borderMuted: color('borderMuted'),
    border: color('border'),
    background: color('background'),
    text: color('text'),
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
  }
}
