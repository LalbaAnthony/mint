import type { Request } from 'express'
import { tooManyAttempts } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'

export function clientIp(request: Request): string {
  return request.ip ?? 'unknown'
}

export function accountKey(email: string): string {
  return email.toLowerCase()
}

export function ensureIpAllowed(app: AppDependencies, ip: string): void {
  const check = app.limiters.ip.check(ip)
  if (!check.allowed) {
    throw tooManyAttempts('too_many_attempts', check.retryAfterSeconds)
  }
}

export function ensureAccountAllowed(
  app: AppDependencies,
  email: string,
): void {
  const check = app.limiters.account.check(accountKey(email))
  if (!check.allowed) {
    throw tooManyAttempts('account_locked', check.retryAfterSeconds)
  }
}

export function recordIpFailure(app: AppDependencies, ip: string): void {
  app.limiters.ip.recordFailure(ip)
}

export function recordAccountFailure(
  app: AppDependencies,
  email: string,
): void {
  const check = app.limiters.account.recordFailure(accountKey(email))
  if (!check.allowed) {
    throw tooManyAttempts('account_locked', check.retryAfterSeconds)
  }
}
