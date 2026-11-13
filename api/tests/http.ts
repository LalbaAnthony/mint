import type { Response } from 'supertest'
import { z } from 'zod'

const setCookieSchema = z.array(z.string())

export function setCookies(response: Response): string[] {
  return setCookieSchema.parse(response.headers['set-cookie'] ?? [])
}

export function findSetCookie(
  response: Response,
  name: string,
): string | undefined {
  return setCookies(response).find((cookie) => cookie.startsWith(`${name}=`))
}

export function captureAuditEvents(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const entry: unknown = JSON.parse(line)
    return typeof entry === 'object' &&
      entry !== null &&
      'audit' in entry &&
      entry.audit === true &&
      'event' in entry &&
      typeof entry.event === 'string'
      ? [entry.event]
      : []
  })
}
