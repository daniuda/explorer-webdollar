const WEBD_GENESIS_UNIX_SECONDS = 1524742312

export function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null
    if (value < 1_000_000_000_000) {
      const seconds = Math.trunc(value)
      const normalizedSeconds = seconds < 1_000_000_000 ? seconds + WEBD_GENESIS_UNIX_SECONDS : seconds
      return normalizedSeconds * 1000
    }
    return Math.trunc(value)
  }

  const raw = String(value).trim()
  if (!raw) return null

  const asNumber = Number(raw)
  if (Number.isFinite(asNumber) && asNumber > 0) {
    if (asNumber < 1_000_000_000_000) {
      const seconds = Math.trunc(asNumber)
      const normalizedSeconds = seconds < 1_000_000_000 ? seconds + WEBD_GENESIS_UNIX_SECONDS : seconds
      return normalizedSeconds * 1000
    }
    return Math.trunc(asNumber)
  }

  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function formatAbsoluteTime(value: unknown): string {
  const ts = parseTimestampMs(value)
  if (!ts) return '-'
  return new Date(ts).toLocaleString('ro-RO')
}

export function formatTimeAgo(value: unknown): string {
  const ts = parseTimestampMs(value)
  if (!ts) return '-'

  const diffMs = Date.now() - ts
  if (!Number.isFinite(diffMs)) return '-'
  if (diffMs <= 0) return 'acum'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `acum ${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `acum ${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `acum ${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 30) return `acum ${days}z`

  const months = Math.floor(days / 30)
  if (months < 12) return `acum ${months} luni`

  const years = Math.floor(months / 12)
  return `acum ${years} ani`
}
