import type { Clock } from './types/clock.js'

export const systemClock: Clock = {
  now: () => new Date(),
}

const parisDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function parisDate(instant: Date): string {
  const parts = parisDateFormat.formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
