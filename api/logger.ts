import type { LogFields, LogLevel } from './types/logger.js'

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = { ...fields, time: new Date().toISOString(), level, event }
  process.stdout.write(`${JSON.stringify(entry)}\n`)
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
