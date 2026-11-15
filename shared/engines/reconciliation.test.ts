import { describe, expect, it } from 'vitest'
import type { ReconciliationOccurrence } from '../types/reconciliation.js'
import {
  candidateScore,
  isCandidate,
  labelSimilarity,
  rankCandidates,
  toleranceCents,
} from './reconciliation.js'

function occurrence(
  overrides: Partial<ReconciliationOccurrence> = {},
): ReconciliationOccurrence {
  return {
    scheduleId: 'prestation',
    scheduleLabel: 'Prestation',
    patterns: [],
    tolerancePct: 10,
    originalDate: '2026-12-05',
    effectiveDate: '2026-12-05',
    accountId: 'current',
    amountCents: 20_000,
    operationId: 'generated',
    reconciledWithBank: false,
    ...overrides,
  }
}

const line = {
  accountId: 'current',
  date: '2026-12-07',
  amountCents: 18_700,
  bankLabel: 'VIR PRESTATION',
}

describe('reconciliation candidates (RAP-01, US-09)', () => {
  it('proposes the occurrence executed two days before with an amount within its tolerance', () => {
    expect(toleranceCents(20_000, 10)).toBe(2_000)
    expect(isCandidate(line, occurrence())).toBe(true)
  })

  it('excludes another account, another sign, an occurrence already reconciled with a bank line', () => {
    expect(isCandidate(line, occurrence({ accountId: 'other' }))).toBe(false)
    expect(isCandidate(line, occurrence({ amountCents: -20_000 }))).toBe(false)
    expect(isCandidate(line, occurrence({ reconciledWithBank: true }))).toBe(
      false,
    )
  })

  it('excludes occurrences more than 5 days away or out of tolerance', () => {
    expect(isCandidate(line, occurrence({ effectiveDate: '2026-12-01' }))).toBe(
      false,
    )
    expect(isCandidate(line, occurrence({ effectiveDate: '2026-12-12' }))).toBe(
      true,
    )
    expect(isCandidate(line, occurrence({ tolerancePct: 5 }))).toBe(false)
  })
})

describe('reconciliation score (RAP-02)', () => {
  it('weights date, amount and label 40/40/20', () => {
    const exact = occurrence({
      effectiveDate: '2026-12-07',
      amountCents: 18_700,
      scheduleLabel: 'VIR PRESTATION',
    })
    expect(candidateScore(line, exact)).toBeCloseTo(1)
    expect(candidateScore(line, occurrence())).toBeCloseTo(
      0.4 * (1 - 2 / 5) + 0.4 * (1 - 1_300 / 2_000) + 0.2 * (2 / 3),
    )
  })

  it('requires the exact amount when the tolerance is zero', () => {
    expect(
      candidateScore(
        line,
        occurrence({ tolerancePct: 0, amountCents: 18_700 }),
      ),
    ).toBeGreaterThan(candidateScore(line, occurrence({ tolerancePct: 0 })))
  })

  it('uses the best of the label and the learnt patterns (RAP-06)', () => {
    expect(
      labelSimilarity('VIR PRESTATION', {
        scheduleLabel: 'Revenu',
        patterns: ['VIR PRESTATION'],
      }),
    ).toBe(1)
  })

  it('ranks the candidates by score then by date proximity', () => {
    const ranked = rankCandidates(line, [
      occurrence({ scheduleId: 'far', effectiveDate: '2026-12-11' }),
      occurrence({ scheduleId: 'near', effectiveDate: '2026-12-06' }),
      occurrence({ scheduleId: 'tie', effectiveDate: '2026-12-08' }),
      occurrence({ scheduleId: 'excluded', accountId: 'other' }),
    ])

    expect(ranked.map((candidate) => candidate.occurrence.scheduleId)).toEqual([
      'near',
      'tie',
      'far',
    ])
    expect(ranked[0]?.dayGap).toBe(1)
  })

  it('breaks an exact tie by the earliest date', () => {
    const ranked = rankCandidates(line, [
      occurrence({ scheduleId: 'later', effectiveDate: '2026-12-08' }),
      occurrence({ scheduleId: 'earlier', effectiveDate: '2026-12-06' }),
    ])

    expect(ranked.map((candidate) => candidate.occurrence.scheduleId)).toEqual([
      'earlier',
      'later',
    ])
  })
})
