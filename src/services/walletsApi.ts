import axios from 'axios'
import { normalizeWebdAmount } from '../utils/webdAmount'

export type WalletEntry = {
  address: string
  balance: number
  source: string
}

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

const toNumber = (value: unknown): number => {
  const normalized = normalizeWebdAmount(value)
  if (normalized === null) return 0
  return Number.isFinite(normalized) ? normalized : 0
}

const extractWalletArray = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>
  if (!payload || typeof payload !== 'object') return []

  const data = payload as Record<string, unknown>
  const candidates = [data.wallets, data.addresses, data.items, data.result, data.data, data.richlist]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>
  }

  return []
}

const parseWalletEntries = (payload: unknown, source: string): WalletEntry[] => {
  const entries = extractWalletArray(payload)
  const parsed: WalletEntry[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    const address = String(
      entry.address
        ?? entry.wallet
        ?? entry.account
        ?? entry.id
        ?? entry.hash
        ?? '',
    ).trim()

    if (!address) continue

    const balance = toNumber(
      entry.balance
        ?? entry.amount
        ?? entry.value
        ?? entry.total
        ?? entry.totalAmount
        ?? entry.totalPOSBalance,
    )

    parsed.push({ address, balance, source })
  }

  return parsed
}

const sortAndLimit = (entries: WalletEntry[], limit: number): WalletEntry[] => {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.balance) && entry.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit)
}

export async function fetchTopWallets(limit = 50): Promise<WalletEntry[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 500))
  const response = await api.get('/wallets/top', { params: { limit: normalizedLimit } })
  const parsed = parseWalletEntries(response.data, 'db:wallets-top')
  return sortAndLimit(parsed, normalizedLimit)
}
