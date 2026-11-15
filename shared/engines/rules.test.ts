import { describe, expect, it } from 'vitest'
import type { RuleInput } from '../types/rules.js'
import { firstMatchingRule, ruleMatches } from './rules.js'

function rule(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    id: 'deezer',
    matchType: 'contains',
    pattern: 'DEEZER',
    accountId: null,
    sign: 'any',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId: 'digital',
    transferAccountId: null,
    active: true,
    ...overrides,
  }
}

const neverRegex = () => false

const subject = {
  accountId: 'current',
  amountCents: -1_199,
  bankLabel: 'PRLV SEPA DEEZER 06/12',
}

describe('categorization rules (REG-01, REG-02, US-18)', () => {
  it('matches a label containing the pattern, whatever the case and accents', () => {
    expect(ruleMatches(rule({ pattern: 'deezer' }), subject, neverRegex)).toBe(
      true,
    )
    expect(
      ruleMatches(
        rule({ pattern: 'crêperie' }),
        { ...subject, bankLabel: 'CB CREPERIE' },
        neverRegex,
      ),
    ).toBe(true)
    expect(
      ruleMatches(
        rule(),
        { ...subject, bankLabel: 'CB BOULANGERIE' },
        neverRegex,
      ),
    ).toBe(false)
  })

  it('matches the start of the label', () => {
    expect(
      ruleMatches(
        rule({ matchType: 'starts_with', pattern: 'prlv sepa' }),
        subject,
        neverRegex,
      ),
    ).toBe(true)
    expect(
      ruleMatches(
        rule({ matchType: 'starts_with', pattern: 'DEEZER' }),
        subject,
        neverRegex,
      ),
    ).toBe(false)
  })

  it('delegates regular expressions to the given engine without accents', () => {
    const calls: [string, string][] = []
    const matcher = (pattern: string, text: string) => {
      calls.push([pattern, text])
      return true
    }

    expect(
      ruleMatches(
        rule({ matchType: 'regex', pattern: '^PRLV.*Électricité' }),
        { ...subject, bankLabel: 'PRLV ÉLECTRICITÉ' },
        matcher,
      ),
    ).toBe(true)
    expect(calls).toEqual([['^PRLV.*Electricite', 'PRLV ELECTRICITE']])
  })

  it('checks the account, the sign and the amount range', () => {
    expect(ruleMatches(rule({ accountId: 'other' }), subject, neverRegex)).toBe(
      false,
    )
    expect(ruleMatches(rule({ sign: 'credit' }), subject, neverRegex)).toBe(
      false,
    )
    expect(
      ruleMatches(
        rule({ sign: 'debit' }),
        { ...subject, amountCents: 1_199 },
        neverRegex,
      ),
    ).toBe(false)
    expect(
      ruleMatches(rule({ amountMinCents: 1_200 }), subject, neverRegex),
    ).toBe(false)
    expect(
      ruleMatches(rule({ amountMaxCents: 1_000 }), subject, neverRegex),
    ).toBe(false)
    expect(
      ruleMatches(
        rule({ sign: 'debit', amountMinCents: 1_000, amountMaxCents: 1_199 }),
        subject,
        neverRegex,
      ),
    ).toBe(true)
  })

  it('applies only the first satisfied active rule', () => {
    const inactive = rule({ id: 'inactive', active: false })
    const first = rule({ id: 'first', pattern: 'SEPA' })
    const second = rule({ id: 'second' })

    expect(
      firstMatchingRule([inactive, first, second], subject, neverRegex)?.id,
    ).toBe('first')
    expect(firstMatchingRule([inactive], subject, neverRegex)).toBeNull()
  })
})
