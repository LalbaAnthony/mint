import type {
  AttemptCheck,
  AttemptLimiter,
  AttemptLimiterOptions,
} from '../types/auth.js'

const fifteenMinutesMs = 15 * 60 * 1000
const sweepThreshold = 10_000

export const accountLimiterPolicy = {
  maxFailures: 5,
  windowMs: fifteenMinutesMs,
  lockMs: fifteenMinutesMs,
}

export const ipLimiterPolicy = {
  maxFailures: 20,
  windowMs: fifteenMinutesMs,
  lockMs: fifteenMinutesMs,
}

export function createAttemptLimiter({
  maxFailures,
  windowMs,
  lockMs,
  now,
}: AttemptLimiterOptions): AttemptLimiter {
  const failuresByKey = new Map<string, number[]>()
  const lockedUntilByKey = new Map<string, number>()

  function blocked(lockedUntil: number, currentTime: number): AttemptCheck {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil - currentTime) / 1000),
    }
  }

  function recentFailures(key: string, currentTime: number): number[] {
    return (failuresByKey.get(key) ?? []).filter(
      (time) => time > currentTime - windowMs,
    )
  }

  function sweep(currentTime: number): void {
    for (const [key, lockedUntil] of lockedUntilByKey) {
      if (lockedUntil <= currentTime) {
        lockedUntilByKey.delete(key)
      }
    }
    for (const key of failuresByKey.keys()) {
      const failures = recentFailures(key, currentTime)
      if (failures.length === 0) {
        failuresByKey.delete(key)
      } else {
        failuresByKey.set(key, failures)
      }
    }
  }

  function check(key: string): AttemptCheck {
    const currentTime = now()
    const lockedUntil = lockedUntilByKey.get(key)
    if (lockedUntil === undefined) {
      return { allowed: true }
    }
    if (lockedUntil > currentTime) {
      return blocked(lockedUntil, currentTime)
    }
    lockedUntilByKey.delete(key)
    return { allowed: true }
  }

  function recordFailure(key: string): AttemptCheck {
    const currentTime = now()
    if (failuresByKey.size + lockedUntilByKey.size > sweepThreshold) {
      sweep(currentTime)
    }
    const failures = [...recentFailures(key, currentTime), currentTime]
    if (failures.length < maxFailures) {
      failuresByKey.set(key, failures)
      return { allowed: true }
    }
    failuresByKey.delete(key)
    const lockedUntil = currentTime + lockMs
    lockedUntilByKey.set(key, lockedUntil)
    return blocked(lockedUntil, currentTime)
  }

  function reset(key: string): void {
    failuresByKey.delete(key)
    lockedUntilByKey.delete(key)
  }

  return { check, recordFailure, reset }
}
