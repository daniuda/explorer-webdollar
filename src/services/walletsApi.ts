import axios from 'axios'
import { normalizeAddressForLookup } from '../utils/addressFormat'
import { normalizeWebdAmount } from '../utils/webdAmount'
import { fetchPools } from './poolsApi'

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

async function tryApiRichList(limit: number): Promise<WalletEntry[] | null> {
  const probes: Array<{ path: string; params?: Record<string, unknown> }> = [
    { path: '/wallets/top', params: { limit } },
    { path: '/wallets', params: { sort: 'balance', order: 'desc', limit } },
    { path: '/rich-list', params: { limit } },
    { path: '/richlist', params: { limit } },
    { path: '/addresses/top', params: { limit } },
  ]

  for (const probe of probes) {
    try {
      const response = await api.get(probe.path, probe.params ? { params: probe.params } : undefined)
      const parsed = parseWalletEntries(response.data, `api:${probe.path}`)
      if (parsed.length > 0) return sortAndLimit(parsed, limit)
    } catch {
      // Try next endpoint probe.
    }
  }

  return null
}

async function fallbackFromPools(limit: number): Promise<WalletEntry[]> {
  const pools = await fetchPools()
  const balances = new Map<string, WalletEntry>()

  for (const pool of pools) {
    for (const miner of pool.miners) {
      const normalizedAddress = normalizeAddressForLookup(miner.address)
      const key = normalizedAddress.toLowerCase()
      if (!key) continue

      const existing = balances.get(key)
      if (existing) {
        existing.balance += miner.balance
      } else {
        balances.set(key, {
          address: normalizedAddress,
          balance: miner.balance,
          source: 'pool-aggregate',
        })
      }
    }
  }

  return sortAndLimit([...balances.values()], limit)
}

export async function fetchTopWallets(limit = 50): Promise<WalletEntry[]> {
  const normalizedLimit = Math.max(1, Math.min(limit, 500))

  const apiRichList = await tryApiRichList(normalizedLimit)
  if (apiRichList && apiRichList.length > 0) return apiRichList

  return fallbackFromPools(normalizedLimit)
}
