import { conflict } from './http-error.js'

export function ensureSameMembers(
  expected: string[],
  received: string[],
): void {
  const receivedSet = new Set(received)
  const matches =
    receivedSet.size === received.length &&
    receivedSet.size === expected.length &&
    expected.every((id) => receivedSet.has(id))
  if (!matches) {
    throw conflict('order_mismatch')
  }
}
