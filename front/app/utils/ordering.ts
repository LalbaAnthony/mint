export function moveItem<Item>(
  items: readonly Item[],
  from: number,
  to: number,
): Item[] {
  const moved = items[from]
  if (moved === undefined || to < 0 || to >= items.length || from === to) {
    return [...items]
  }
  const remaining = items.filter((_, index) => index !== from)
  return [...remaining.slice(0, to), moved, ...remaining.slice(to)]
}
