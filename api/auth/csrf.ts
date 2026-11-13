import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler, Response } from 'express'
import { HttpError } from '../http/http-error.js'
import type { CsrfOptions } from '../types/auth.js'

export const csrfHeaderName = 'x-csrf-token'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const cookieValuePattern = /^[A-Za-z0-9_-]{43}$/

export function csrfCookieName(secure: boolean): string {
  return secure ? '__Host-mint-csrf' : 'mint-csrf'
}

export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (header === undefined) {
    return undefined
  }
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator !== -1 && pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim()
    }
  }
  return undefined
}

function sessionBinding(request: Request): string {
  return request.session.userId === undefined ? '' : request.sessionID
}

function sign(secret: string, cookieValue: string, binding: string): string {
  return createHmac('sha256', secret)
    .update(`csrf:${cookieValue}.${binding}`)
    .digest('base64url')
}

function isSameToken(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}

function readCookieValue(
  request: Request,
  options: CsrfOptions,
): string | undefined {
  const value = readCookie(
    request.headers.cookie,
    csrfCookieName(options.secureCookies),
  )
  return value !== undefined && cookieValuePattern.test(value)
    ? value
    : undefined
}

export function issueCsrfToken(
  request: Request,
  response: Response,
  options: CsrfOptions,
): string {
  let cookieValue = readCookieValue(request, options)
  if (cookieValue === undefined) {
    cookieValue = randomBytes(32).toString('base64url')
    response.cookie(csrfCookieName(options.secureCookies), cookieValue, {
      httpOnly: true,
      secure: options.secureCookies,
      sameSite: 'strict',
      path: '/',
    })
  }
  return sign(options.secret, cookieValue, sessionBinding(request))
}

export function createCsrfVerifier(options: CsrfOptions): RequestHandler {
  return (request, _response, next) => {
    if (safeMethods.has(request.method)) {
      next()
      return
    }
    const cookieValue = readCookieValue(request, options)
    const received = request.get(csrfHeaderName)
    const valid =
      cookieValue !== undefined &&
      received !== undefined &&
      isSameToken(
        received,
        sign(options.secret, cookieValue, sessionBinding(request)),
      )
    next(
      valid ? undefined : new HttpError({ status: 403, code: 'csrf_invalid' }),
    )
  }
}
