export function formatAddressDisplay(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('WEBD')) return raw
  return `WEBD*${raw}`
}
