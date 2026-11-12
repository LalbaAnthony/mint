import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeError, log } from './logger.js'

function captureStdout(): string[] {
  const lines: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  return lines
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('log', () => {
  it('writes one JSON line with time, level, event and fields', () => {
    const lines = captureStdout()

    log('info', 'api_listening', { port: 3000 })

    expect(lines).toHaveLength(1)
    expect(lines[0]?.endsWith('\n')).toBe(true)
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      level: 'info',
      event: 'api_listening',
      port: 3000,
    })
  })

  it('keeps time, level and event when fields reuse their names', () => {
    const lines = captureStdout()

    log('warn', 'migration', { level: 'debug', event: 'other', time: 'x' })

    expect(JSON.parse(lines[0] ?? '')).toEqual(
      expect.objectContaining({ level: 'warn', event: 'migration' }),
    )
    expect(JSON.parse(lines[0] ?? '').time).not.toBe('x')
  })
})

describe('describeError', () => {
  it('returns the message of an Error', () => {
    expect(describeError(new Error('connection refused'))).toBe(
      'connection refused',
    )
  })

  it('stringifies anything else', () => {
    expect(describeError(42)).toBe('42')
  })
})
