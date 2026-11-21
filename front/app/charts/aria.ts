export function chartAria(description: string | null) {
  return description === null
    ? { enabled: true, decal: { show: true } }
    : { enabled: true, label: { description }, decal: { show: true } }
}
