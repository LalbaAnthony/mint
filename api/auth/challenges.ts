import { randomBytes } from 'node:crypto'
import type {
  ChallengeEntry,
  ChallengePurpose,
  ChallengeStore,
} from '../types/auth.js'

export const challengeLifetimeMs = 5 * 60 * 1000

export const maxPendingChallenges = 10_000

export function createChallengeStore(now: () => number): ChallengeStore {
  const entries = new Map<string, ChallengeEntry>()

  function sweep(currentTime: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= currentTime) {
        entries.delete(key)
      }
    }
    for (const key of entries.keys()) {
      if (entries.size < maxPendingChallenges) {
        return
      }
      entries.delete(key)
    }
  }

  return {
    issue: (entry) => {
      const currentTime = now()
      sweep(currentTime)
      const key = randomBytes(32).toString('base64url')
      entries.set(key, {
        ...entry,
        expiresAt: currentTime + challengeLifetimeMs,
      })
      return key
    },
    consume: (key: string, purpose: ChallengePurpose) => {
      const entry = entries.get(key)
      entries.delete(key)
      if (
        entry === undefined ||
        entry.purpose !== purpose ||
        entry.expiresAt <= now()
      ) {
        return null
      }
      return entry
    },
  }
}
