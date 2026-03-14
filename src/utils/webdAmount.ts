const WEBD_ATOMIC_UNITS = 10_000

type FormatOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  suffix?: string
  fallback?: string
}

export function normalizeWebdAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(numeric)) return null

  // Explorer endpoints can return raw atomic units for WEBD.
  if (Math.abs(numeric) >= WEBD_ATOMIC_UNITS) {
    return numeric / WEBD_ATOMIC_UNITS
  }

  return numeric
}

export function formatWebdAmount(value: unknown, options: FormatOptions = {}): string {
  const normalized = normalizeWebdAmount(value)
  const fallback = options.fallback ?? '-'

  if (normalized === null) return fallback

  const minimumFractionDigits = options.minimumFractionDigits ?? 4
  const maximumFractionDigits = options.maximumFractionDigits ?? 4
  const suffix = options.suffix === undefined ? 'WEBD' : options.suffix

  const rendered = normalized.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  })

  return suffix ? `${rendered} ${suffix}` : rendered
}