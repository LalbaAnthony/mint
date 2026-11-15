import type {
  ReconciliationLine,
  ReconciliationOccurrence,
  ScoredCandidate,
} from '../types/reconciliation.js'
import { daysBetween } from './dates.js'
import { diceSimilarity } from './labels.js'

export const reconciliationWindowDays = 5

const dateWeight = 0.4
const amountWeight = 0.4
const labelWeight = 0.2

export function toleranceCents(
  amountCents: number,
  tolerancePct: number,
): number {
  return Math.floor((Math.abs(amountCents) * tolerancePct) / 100)
}

export function labelSimilarity(
  bankLabel: string,
  occurrence: Pick<ReconciliationOccurrence, 'scheduleLabel' | 'patterns'>,
): number {
  return Math.max(
    diceSimilarity(bankLabel, occurrence.scheduleLabel),
    ...occurrence.patterns.map((pattern) => diceSimilarity(bankLabel, pattern)),
  )
}

export function isCandidate(
  line: ReconciliationLine,
  occurrence: ReconciliationOccurrence,
): boolean {
  if (
    occurrence.reconciledWithBank ||
    occurrence.accountId !== line.accountId ||
    Math.sign(occurrence.amountCents) !== Math.sign(line.amountCents)
  ) {
    return false
  }
  const dayGap = Math.abs(daysBetween(occurrence.effectiveDate, line.date))
  const amountGap = Math.abs(line.amountCents - occurrence.amountCents)
  return (
    dayGap <= reconciliationWindowDays &&
    amountGap <= toleranceCents(occurrence.amountCents, occurrence.tolerancePct)
  )
}

export function candidateScore(
  line: ReconciliationLine,
  occurrence: ReconciliationOccurrence,
): number {
  const dayGap = Math.abs(daysBetween(occurrence.effectiveDate, line.date))
  const amountGap = Math.abs(line.amountCents - occurrence.amountCents)
  const tolerance = toleranceCents(
    occurrence.amountCents,
    occurrence.tolerancePct,
  )
  const amountCloseness =
    tolerance === 0 ? (amountGap === 0 ? 1 : 0) : 1 - amountGap / tolerance
  return (
    dateWeight * (1 - dayGap / reconciliationWindowDays) +
    amountWeight * amountCloseness +
    labelWeight * labelSimilarity(line.bankLabel, occurrence)
  )
}

export function rankCandidates(
  line: ReconciliationLine,
  occurrences: readonly ReconciliationOccurrence[],
): ScoredCandidate[] {
  return occurrences
    .filter((occurrence) => isCandidate(line, occurrence))
    .map((occurrence) => ({
      occurrence,
      score: Math.round(candidateScore(line, occurrence) * 1000) / 1000,
      dayGap: Math.abs(daysBetween(occurrence.effectiveDate, line.date)),
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.dayGap - second.dayGap ||
        first.occurrence.effectiveDate.localeCompare(
          second.occurrence.effectiveDate,
        ),
    )
}
