export function formatAddressDisplay(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw
}
