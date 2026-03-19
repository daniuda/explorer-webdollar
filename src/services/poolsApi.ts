import axios from 'axios'

export type PoolMiner = {
  address: string
  balance: number
}

export type PoolStats = {
  onlineMiners: number
  blocksPaid: number
  blocksUnpaid: number
  blocksUnconfirmed: number
  blocksBeingConfirmed: number
}

export type PoolSummary = {
  name: string
  miners: PoolMiner[]
  stats: PoolStats
  totalPosWebd: number
}

export type MarketSummary = {
  webdUsdt: number
  webdVd: number
  vdUsdt: number
  webdUsd: number
  webdUsdFromVd: number
  usdComputedAt: string
}

export const POOLS: Array<{ name: string; miners: string; stats: string }> = [
  {
    name: 'iudaWEBD',
    miners: '/pool-proxy/daniuda/miners',
    stats: '/pool-proxy/daniuda/stats',
  },
  {
    name: 'Spyclub',
    miners: '/pool-proxy/spyclub/miners',
    stats: '/pool-proxy/spyclub/stats',
  },
  {
    name: 'Timi',
    miners: '/pool-proxy/timi/miners',
    stats: '/pool-proxy/timi/stats',
  },
]

const VINDAX_TICKER_ENDPOINT = '/market-proxy/vindax/ticker/24hr'
const VINDAX_SYMBOLS = {
  WEBD_USDT: 'WEBDUSDT',
  WEBD_VD: 'WEBDVD',
  VD_USDT: 'VDUSDT',
}
const VD_USDT_DAILY_CACHE_KEY = 'webdExplorer.vdUsdtDailyCache.v1'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

type DailyVdUsdtCache = {
  vdUsdt: number
  computedAt: string
  expiresAt: number
}

const addressRegex = /"(?:address|adress)"\s*:\s*"([^"]+)"/gi
const balanceRegex = /"totalPOSBalance"\s*:\s*"?(\d+(?:\.\d+)?)"?/gi

const http = axios.create({ timeout: 10000 })

const normalizeBalance = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  const numeric = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(numeric)) return 0
  if (numeric >= 10000) return numeric / 10000
  return numeric
}

const parseVindaxLast = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0
  const data = payload as Record<string, unknown>
  const last = Number(data.lastPrice ?? data.last ?? 0)
  return Number.isFinite(last) ? last : 0
}

const isBrowser = typeof window !== 'undefined'

const readDailyVdUsdtCache = (): DailyVdUsdtCache | null => {
  if (!isBrowser) return null
  try {
    const raw = window.localStorage.getItem(VD_USDT_DAILY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyVdUsdtCache
    if (!parsed || typeof parsed !== 'object') return null
    if (!Number.isFinite(parsed.vdUsdt) || !Number.isFinite(parsed.expiresAt)) return null
    if (Date.now() >= parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

const writeDailyVdUsdtCache = (cache: DailyVdUsdtCache): void => {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(VD_USDT_DAILY_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage write failures.
  }
}

const parsePoolStats = (payload: unknown): PoolStats => {
  const stats: PoolStats = {
    onlineMiners: 0,
    blocksPaid: 0,
    blocksUnpaid: 0,
    blocksUnconfirmed: 0,
    blocksBeingConfirmed: 0,
  }

  const parseFromObject = (data: Record<string, unknown>): PoolStats => {
    const output: PoolStats = { ...stats }

    const readNumber = (keys: string[]): number => {
      for (const key of keys) {
        const value = Number(data[key] ?? Number.NaN)
        if (Number.isFinite(value)) return value
      }
      return 0
    }

    output.onlineMiners = readNumber(['onlineMiners', 'minersOnline', 'miners_online', 'online_mineri'])
    output.blocksPaid = readNumber(['blocksPaid', 'blocks_paid', 'blocks_confirmed_and_paid', 'blocuri_platite'])
    output.blocksUnpaid = readNumber(['blocksUnpaid', 'blocks_unpaid', 'blocks_confirmed', 'blocuri_neplatite'])
    output.blocksUnconfirmed = readNumber(['blocksUnconfirmed', 'blocks_unconfirmed', 'blocuri_unconfirmed'])
    output.blocksBeingConfirmed = readNumber(['blocksBeingConfirmed', 'blocks_being_confirmed'])

    return output
  }

  const parseLegacyString = (raw: string): PoolStats => {
    const output: PoolStats = { ...stats }
    const chunks = raw.split(',')

    const atIndex = (index: number): number => {
      if (index >= chunks.length) return 0
      const chunk = chunks[index]
      if (!chunk) return 0
      const parts = chunk.split(':')
      if (parts.length < 2) return 0
      const rawValue = parts[1]
      if (!rawValue) return 0
      const value = Number(rawValue.replace(/[\"{}]/g, '').trim())
      return Number.isFinite(value) ? value : 0
    }

    // Compatibil cu index.py (fallback pe pozitii)
    output.onlineMiners = atIndex(2)
    output.blocksPaid = atIndex(3)
    output.blocksUnconfirmed = atIndex(4)
    output.blocksUnpaid = atIndex(5)
    output.blocksBeingConfirmed = atIndex(6)
    return output
  }

  if (!payload) return stats

  if (typeof payload === 'object') {
    return parseFromObject(payload as Record<string, unknown>)
  }

  if (typeof payload !== 'string') return stats

  const raw = payload.trim()
  if (!raw) return stats

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parseFromObject(parsed as Record<string, unknown>)
    }
  } catch {
    // Continue with legacy fallback
  }

  return parseLegacyString(raw)
}

const parsePoolMiners = (payload: unknown): PoolMiner[] => {
  const miners: PoolMiner[] = []

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue
      const data = item as Record<string, unknown>
      const address = String(data.address ?? data.adress ?? '').trim()
      const balance = normalizeBalance(data.totalPOSBalance)
      if (address) miners.push({ address, balance })
    }
  } else if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const nested = Array.isArray(container.miners)
      ? container.miners
      : Array.isArray(container.data)
        ? container.data
        : []

    for (const item of nested) {
      if (!item || typeof item !== 'object') continue
      const data = item as Record<string, unknown>
      const address = String(data.address ?? data.adress ?? '').trim()
      const balance = normalizeBalance(data.totalPOSBalance)
      if (address) miners.push({ address, balance })
    }
  }

  if (miners.length > 0) {
    const dedupeByBalance = new Map<number, PoolMiner>()
    for (const miner of miners) {
      if (!dedupeByBalance.has(miner.balance)) {
        dedupeByBalance.set(miner.balance, miner)
      }
    }
    return [...dedupeByBalance.values()].sort((a, b) => b.balance - a.balance)
  }

  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')
  const addresses = [...raw.matchAll(addressRegex)].map((match) => match[1])
  const balances = [...raw.matchAll(balanceRegex)].map((match) => Number(match[1] ?? 0))

  return addresses
    .map((address, index) => ({
      address: String(address),
      balance: normalizeBalance(balances[index] ?? 0),
    }))
    .sort((a, b) => b.balance - a.balance)
}

async function safeGet<T = unknown>(url: string): Promise<T | null> {
  try {
    const response = await http.get(url)
    return response.data as T
  } catch {
    return null
  }
}

async function safeGetWithParams<T = unknown>(url: string, params: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await http.get(url, { params })
    return response.data as T
  } catch {
    return null
  }
}

async function fetchVindaxLastPrice(symbol: string): Promise<number> {
  const raw = await safeGetWithParams(VINDAX_TICKER_ENDPOINT, { symbol })
  return parseVindaxLast(raw)
}

async function getDailyVdUsdtRate(): Promise<DailyVdUsdtCache> {
  const cached = readDailyVdUsdtCache()
  if (cached) return cached

  const freshRate = await fetchVindaxLastPrice(VINDAX_SYMBOLS.VD_USDT)
  const computedAt = new Date().toISOString()
  const nextCache: DailyVdUsdtCache = {
    vdUsdt: freshRate,
    computedAt,
    expiresAt: Date.now() + ONE_DAY_MS,
  }
  writeDailyVdUsdtCache(nextCache)
  return nextCache
}

export async function fetchMarkets(): Promise<MarketSummary> {
  const [webdUsdt, webdVd, vdDaily] = await Promise.all([
    fetchVindaxLastPrice(VINDAX_SYMBOLS.WEBD_USDT),
    fetchVindaxLastPrice(VINDAX_SYMBOLS.WEBD_VD),
    getDailyVdUsdtRate(),
  ])

  const vdUsdt = vdDaily.vdUsdt
  const webdUsdFromVd = webdVd > 0 && vdUsdt > 0 ? webdVd * vdUsdt : 0
  const webdUsd = webdUsdt > 0 ? webdUsdt : webdUsdFromVd

  return {
    webdUsdt,
    webdVd,
    vdUsdt,
    webdUsd,
    webdUsdFromVd,
    usdComputedAt: vdDaily.computedAt,
  }
}

export async function fetchPools(): Promise<PoolSummary[]> {
  const summaries = await Promise.all(
    POOLS.map(async (pool) => {
      const [minersRaw, statsRaw] = await Promise.all([safeGet(pool.miners), safeGet(pool.stats)])
      const miners = parsePoolMiners(minersRaw)
      const stats = parsePoolStats(statsRaw)
      const totalPosWebd = miners.reduce((sum, miner) => sum + miner.balance, 0)

      return {
        name: pool.name,
        miners,
        stats,
        totalPosWebd,
      }
    }),
  )

  return summaries
}
