import type { Clock } from './types/clock.js'

export const systemClock: Clock = {
  now: () => new Date(),
}
