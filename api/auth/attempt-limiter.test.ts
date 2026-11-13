import { describe, expect, it } from 'vitest'
import {
  accountLimiterPolicy,
  createAttemptLimiter,
  ipLimiterPolicy,
} from './attempt-limiter.js'

const minute = 60 * 1000

function createLimiter(policy: typeof accountLimiterPolicy) {
  let now = Date.parse('2026-11-11T10:00:00Z')
  const limiter = createAttemptLimiter({ ...policy, now: () => now })
  return {
    limiter,
    advance: (milliseconds: number) => {
      now += milliseconds
    },
  }
}

describe('account limiter (AUTH-06)', () => {
  it('locks the account for 15 minutes on the fifth failure within 15 minutes', () => {
    const { limiter, advance } = createLimiter(accountLimiterPolicy)

    for (let failure = 1; failure <= 4; failure += 1) {
      expect(limiter.recordFailure('a@example.org')).toEqual({ allowed: true })
      advance(3 * minute)
    }

    expect(limiter.recordFailure('a@example.org')).toEqual({
      allowed: false,
      retryAfterSeconds: 900,
    })
    expect(limiter.check('a@example.org')).toEqual({
      allowed: false,
      retryAfterSeconds: 900,
    })

    advance(15 * minute - 1000)
    expect(limiter.check('a@example.org')).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    })

    advance(1000)
    expect(limiter.check('a@example.org')).toEqual({ allowed: true })
  })

  it('forgets failures older than 15 minutes', () => {
    const { limiter, advance } = createLimiter(accountLimiterPolicy)

    for (let failure = 1; failure <= 4; failure += 1) {
      limiter.recordFailure('a@example.org')
    }
    advance(15 * minute + 1)

    expect(limiter.recordFailure('a@example.org')).toEqual({ allowed: true })
  })

  it('keeps accounts independent and resets on demand', () => {
    const { limiter } = createLimiter(accountLimiterPolicy)

    for (let failure = 1; failure <= 5; failure += 1) {
      limiter.recordFailure('a@example.org')
    }

    expect(limiter.check('b@example.org')).toEqual({ allowed: true })

    limiter.reset('a@example.org')

    expect(limiter.check('a@example.org')).toEqual({ allowed: true })
  })
})

describe('ip limiter (AUTH-06)', () => {
  it('locks an address on the twentieth failure', () => {
    const { limiter } = createLimiter(ipLimiterPolicy)

    for (let failure = 1; failure <= 19; failure += 1) {
      expect(limiter.recordFailure('203.0.113.7').allowed).toBe(true)
    }

    expect(limiter.recordFailure('203.0.113.7').allowed).toBe(false)
    expect(limiter.check('203.0.113.8')).toEqual({ allowed: true })
  })

  it('sweeps stale entries once many keys are tracked', () => {
    const { limiter, advance } = createLimiter(ipLimiterPolicy)

    for (let key = 0; key <= 10_001; key += 1) {
      limiter.recordFailure(`198.51.100.${key}`)
    }
    advance(16 * minute)

    expect(limiter.recordFailure('198.51.100.0')).toEqual({ allowed: true })
    expect(limiter.check('198.51.100.1')).toEqual({ allowed: true })
  })
})
