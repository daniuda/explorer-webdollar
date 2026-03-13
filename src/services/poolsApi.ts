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
  webdEth: number
}

export const POOLS: Array<{ name: string; miners: string; stats: string }> = [
  {
    name: 'iudaWEBD',
    miners: 'http://daniuda.ddns.net:8080/pools/miners',
    stats: 'http://daniuda.ddns.net:8080/pools/stats',
  },
  {
    name: 'Spyclub',
    miners: 'https://node.spyclub.ro:8080/pools/miners',
    stats: 'https://node.spyclub.ro:8080/pools/stats',
  },
]

const MARKET_URLS = {
  WEBD_USDT: 'https://api.indoex.io/getSelectedMarket/WEBD_USDT',
  WEBD_ETH: 'https://api.indoex.io/getSelectedMarket/WEBD_ETH',
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

const parseMarketLast = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0
  const marketDetails = (payload as Record<string, unknown>).marketdetails
  if (!Array.isArray(marketDetails) || marketDetails.length === 0) return 0
  const first = marketDetails[0]
  if (!first || typeof first !== 'object') return 0
  const last = Number((first as Record<string, unknown>).last ?? 0)
  return Number.isFinite(last) ? last : 0
}

const parsePoolStats = (payload: unknown): PoolStats => {
  const stats: PoolStats = {
    onlineMiners: 0,
    blocksPaid: 0,
    blocksUnpaid: 0,
    blocksUnconfirmed: 0,
    blocksBeingConfirmed: 0,
  }

  if (!payload || typeof payload !== 'object') return stats
  const data = payload as Record<string, unknown>

  const readNumber = (keys: string[]): number => {
    for (const key of keys) {
      const value = Number(data[key] ?? 0)
      if (Number.isFinite(value)) return value
    }
    return 0
  }

  stats.onlineMiners = readNumber(['onlineMiners', 'minersOnline', 'miners_online', 'online_mineri'])
  stats.blocksPaid = readNumber(['blocksPaid', 'blocks_paid', 'blocks_confirmed_and_paid', 'blocuri_platite'])
  stats.blocksUnpaid = readNumber(['blocksUnpaid', 'blocks_unpaid', 'blocks_confirmed', 'blocuri_neplatite'])
  stats.blocksUnconfirmed = readNumber(['blocks_unconfirmed', 'blocuri_unconfirmed'])
  stats.blocksBeingConfirmed = readNumber(['blocksBeingConfirmed', 'blocks_being_confirmed'])

  return stats
}

const parsePoolMiners = (payload: unknown): PoolMiner[] => {
  const miners: PoolMiner[] = []

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue
      const data = item as Record<string, unknown>
      const address = String(data.address ?? data.adress ?? '').trim()
      const balance = normalizeBalance(data.totalPOSBalance)
      if (address) miners.push({ address: address.slice(0, 40), balance })
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
      if (address) miners.push({ address: address.slice(0, 40), balance })
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
      address: String(address).slice(0, 40),
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

export async function fetchMarkets(): Promise<MarketSummary> {
  const [usdtRaw, ethRaw] = await Promise.all([
    safeGet(MARKET_URLS.WEBD_USDT),
    safeGet(MARKET_URLS.WEBD_ETH),
  ])

  return {
    webdUsdt: parseMarketLast(usdtRaw),
    webdEth: parseMarketLast(ethRaw),
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
