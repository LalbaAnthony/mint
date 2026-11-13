import { describe, expect, it } from 'vitest'
import { acceptInvitationRequestSchema, tokenSchema } from './auth.js'
import {
  allocationTargetsSchema,
  emailSchema,
  forecastHorizonSchema,
  newPasswordSchema,
} from './user.js'

function firstMessage(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}): string | undefined {
  return result.error?.issues[0]?.message
}

describe('shared validation rules', () => {
  it('requires 12 characters for a new password (AUTH-02)', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(12)).success).toBe(true)
    expect(firstMessage(newPasswordSchema.safeParse('a'.repeat(11)))).toBe(
      'password_too_short',
    )
    expect(firstMessage(newPasswordSchema.safeParse('a'.repeat(257)))).toBe(
      'too_long',
    )
  })

  it('validates email addresses', () => {
    expect(emailSchema.safeParse('person@example.org').success).toBe(true)
    expect(firstMessage(emailSchema.safeParse('person@'))).toBe('invalid_email')
  })

  it('bounds the forecast horizon to 1 to 12 months (AUTH-07)', () => {
    expect(forecastHorizonSchema.safeParse(1).success).toBe(true)
    expect(forecastHorizonSchema.safeParse(12).success).toBe(true)
    expect(firstMessage(forecastHorizonSchema.safeParse(13))).toBe(
      'horizon_out_of_range',
    )
    expect(firstMessage(forecastHorizonSchema.safeParse(1.5))).toBe(
      'horizon_out_of_range',
    )
  })

  it('requires allocation targets summing to 100 (CAT-06)', () => {
    expect(
      allocationTargetsSchema.safeParse({ needs: 50, wants: 30, save: 20 })
        .success,
    ).toBe(true)
    expect(
      firstMessage(
        allocationTargetsSchema.safeParse({ needs: 50, wants: 30, save: 30 }),
      ),
    ).toBe('targets_sum_not_100')
  })

  it('accepts only url-safe tokens', () => {
    expect(tokenSchema.safeParse('abc_DEF-123-abc_DEF-123').success).toBe(true)
    expect(tokenSchema.safeParse('abc def').success).toBe(false)
  })

  it('accepts an invitation in French or English only', () => {
    expect(
      acceptInvitationRequestSchema.safeParse({
        token: 'a'.repeat(43),
        password: 'a'.repeat(12),
        locale: 'de',
      }).success,
    ).toBe(false)
  })
})
