import { describe, expect, it } from 'vitest'
import {
  diceSimilarity,
  foldForMatching,
  labelWords,
  normalizeBankLabel,
  rulePatternFromBankLabel,
} from './labels.js'

describe('bank label normalization (IMP-05, REG-01, REG-03)', () => {
  it('upper-cases, removes accents and collapses spaces for duplicates', () => {
    expect(normalizeBankLabel('  Prlv  SEPA   Électricité ')).toBe(
      'PRLV SEPA ELECTRICITE',
    )
  })

  it('folds case and accents for rule matching', () => {
    expect(foldForMatching('CB  Crêperie  ')).toBe('cb creperie')
  })

  it('removes digits and dates to suggest a rule pattern', () => {
    expect(rulePatternFromBankLabel('PRLV SEPA DEEZER 06/12 REF 123456')).toBe(
      'PRLV SEPA DEEZER REF',
    )
    expect(rulePatternFromBankLabel('CB CARREFOUR 2026-11-05')).toBe(
      'CB CARREFOUR',
    )
  })

  it('splits words and measures their overlap', () => {
    expect(labelWords('VIR. PRESTATION/2026 x')).toEqual([
      'vir',
      'prestation',
      '2026',
    ])
    expect(diceSimilarity('VIR PRESTATION', 'Prestation')).toBeCloseTo(2 / 3)
    expect(diceSimilarity('', 'Prestation')).toBe(0)
    expect(diceSimilarity('Loyer', 'Salaire')).toBe(0)
  })
})
