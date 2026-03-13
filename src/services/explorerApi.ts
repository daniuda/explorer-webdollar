import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

export type ChainResponse = {
  syncing?: boolean
  transactionsCount?: number
  id?: string
  hash?: string
  height?: number
  [key: string]: unknown
}

export type GenericRecord = Record<string, unknown>

type ChainLike = {
  hash?: string
  height?: number
  [key: string]: unknown
}

type NormalizedBlock = GenericRecord & {
  hash: string
  hashPrev: string
  height: number
  timestamp: number | string
  minerAddress: string
  transactions: unknown[]
}

type RecentBlocksCache = {
  blocks: NormalizedBlock[]
  limit: number
  expiry: number
  pending: Promise<NormalizedBlock[]> | null
  pendingLimit: number
}

const RECENT_BLOCKS_TTL_MS = 30_000

const recentBlocksCache: RecentBlocksCache = {
  blocks: [],
  limit: 0,
  expiry: 0,
  pending: null,
  pendingLimit: 0,
}

const safeArray = (value: unknown): GenericRecord[] => {
  if (Array.isArray(value)) return value as GenericRecord[]
  return []
}

const parseBlocksPayload = (payload: unknown): GenericRecord[] => {
  if (!payload || typeof payload !== 'object') return []
  const data = payload as Record<string, unknown>

  if (Array.isArray(data.blocks)) return safeArray(data.blocks)
  if (Array.isArray(data.result)) return safeArray(data.result)
  if (Array.isArray(data.data)) return safeArray(data.data)

  return []
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toString = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

const extractBlockLayers = (payload: unknown): {
  raw: GenericRecord
  level1: GenericRecord
  level2: GenericRecord
} => {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as GenericRecord
  const level1 = (raw.data && typeof raw.data === 'object' ? raw.data : raw) as GenericRecord
  const level2 = (level1.data && typeof level1.data === 'object' ? level1.data : level1) as GenericRecord
  return { raw, level1, level2 }
}

const normalizeBlock = (payload: unknown): NormalizedBlock => {
  const { raw, level1, level2 } = extractBlockLayers(payload)

  const hash = toString(level1.hash ?? raw.hash)
  const hashPrev = toString(level1.hashPrev ?? raw.hashPrev)
  const height = toNumber(level1.height ?? raw.height)
  const timestamp =
    (level1.timeStamp as number | string | undefined) ??
    (level1.timestamp as number | string | undefined) ??
    (raw.timeStamp as number | string | undefined) ??
    (raw.timestamp as number | string | undefined) ??
    '-'
  const minerAddress = toString(level2.minerAddress ?? level1.minerAddress ?? raw.minerAddress)
  const transactions = Array.isArray(level2.transactions)
    ? level2.transactions
    : Array.isArray(level1.transactions)
      ? level1.transactions
      : []

  return {
    ...raw,
    hash,
    hashPrev,
    height,
    timestamp,
    minerAddress,
    transactions,
  }
}

const txIdFromUnknown = (tx: unknown): string => {
  if (typeof tx === 'string') return tx
  if (!tx || typeof tx !== 'object') return ''
  const data = tx as GenericRecord
  return toString(data.txId ?? data.hash ?? data.id)
}

const addressFromTxSide = (side: unknown): string[] => {
  if (!Array.isArray(side)) return []
  return side
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return ''
      return toString((entry as GenericRecord).address)
    })
    .filter(Boolean)
}

const amountFromTxSideForAddress = (side: unknown, address: string): number => {
  if (!Array.isArray(side)) return 0
  let total = 0
  for (const entry of side) {
    if (!entry || typeof entry !== 'object') continue
    const data = entry as GenericRecord
    if (toString(data.address) !== address) continue
    total += toNumber(data.amount)
  }
  return total
}

async function firstSuccessful<T>(requests: Array<() => Promise<T>>): Promise<T> {
  let lastError: unknown
  for (const request of requests) {
    try {
      return await request()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function fetchBlockRaw(param: string): Promise<GenericRecord> {
  const response = await api.get(`/block/${encodeURIComponent(param)}`)
  return (response.data ?? {}) as GenericRecord
}

async function scanRecentBlocks(limit: number): Promise<NormalizedBlock[]> {
  const chain = await fetchChain()
  const tipHash = toString((chain as ChainLike).hash)
  if (!tipHash) return []

  const blocks: NormalizedBlock[] = []
  const seen = new Set<string>()
  let cursorHash = tipHash

  for (let i = 0; i < limit; i += 1) {
    if (!cursorHash || seen.has(cursorHash)) break
    seen.add(cursorHash)

    try {
      const raw = await fetchBlockRaw(cursorHash)
      const block = normalizeBlock(raw)
      blocks.push(block)
      cursorHash = block.hashPrev
    } catch {
      break
    }
  }

  return blocks
}

async function getRecentBlocks(limit: number): Promise<NormalizedBlock[]> {
  const normalizedLimit = Math.max(1, limit)
  const now = Date.now()

  if (
    recentBlocksCache.blocks.length > 0
    && recentBlocksCache.limit >= normalizedLimit
    && recentBlocksCache.expiry > now
  ) {
    return recentBlocksCache.blocks.slice(0, normalizedLimit)
  }

  if (recentBlocksCache.pending && recentBlocksCache.pendingLimit >= normalizedLimit) {
    const blocks = await recentBlocksCache.pending
    return blocks.slice(0, normalizedLimit)
  }

  recentBlocksCache.pendingLimit = normalizedLimit
  recentBlocksCache.pending = scanRecentBlocks(normalizedLimit)

  try {
    const blocks = await recentBlocksCache.pending
    recentBlocksCache.blocks = blocks
    recentBlocksCache.limit = normalizedLimit
    recentBlocksCache.expiry = Date.now() + RECENT_BLOCKS_TTL_MS
    return blocks
  } finally {
    recentBlocksCache.pending = null
    recentBlocksCache.pendingLimit = 0
  }
}

export async function fetchChain(): Promise<ChainResponse> {
  const response = await api.get('/chain')
  return response.data as ChainResponse
}

export async function fetchLatestBlocks(): Promise<GenericRecord[]> {
  const scanned = await getRecentBlocks(12)
  if (scanned.length > 0) return scanned

  const data = await firstSuccessful<unknown>([async () => (await api.get('/blocks')).data])
  return parseBlocksPayload(data).map((item) => normalizeBlock(item))
}

export async function fetchBlockByParam(param: string): Promise<GenericRecord> {
  const trimmed = param.trim()
  try {
    return normalizeBlock(await fetchBlockRaw(trimmed))
  } catch {
    // Fallback: search recent blocks by height/hash when direct lookup fails.
    const scanned = await getRecentBlocks(250)
    const targetHeight = Number(trimmed)
    const byHeight = Number.isFinite(targetHeight)
      ? scanned.find((block) => block.height === targetHeight)
      : undefined
    if (byHeight) return byHeight

    const byHash = scanned.find((block) => block.hash === trimmed)
    if (byHash) return byHash

    throw new Error(`Block not found for param ${trimmed}`)
  }
}

export async function fetchTransaction(txId: string): Promise<GenericRecord> {
  const trimmed = txId.trim()
  try {
    const response = await api.get(`/tx/${encodeURIComponent(trimmed)}`)
    return (response.data ?? {}) as GenericRecord
  } catch {
    const scanned = await getRecentBlocks(600)
    for (const block of scanned) {
      for (const tx of block.transactions) {
        if (txIdFromUnknown(tx) !== trimmed) continue
        if (tx && typeof tx === 'object') {
          return {
            ...(tx as GenericRecord),
            txId: trimmed,
            blockHash: block.hash,
            blockHeight: block.height,
            timestamp: block.timestamp,
          }
        }
        return {
          txId: trimmed,
          blockHash: block.hash,
          blockHeight: block.height,
          timestamp: block.timestamp,
        }
      }
    }

    throw new Error(`Transaction ${trimmed} was not found in recent blocks.`)
  }
}

export async function fetchAddress(address: string): Promise<GenericRecord> {
  const trimmed = address.trim()
  try {
    const response = await api.get(`/address/${encodeURIComponent(trimmed)}`)
    return (response.data ?? {}) as GenericRecord
  } catch {
    const scanned = await getRecentBlocks(450)
    let minedBlocks = 0
    let txCount = 0
    let totalIn = 0
    let totalOut = 0
    let lastSeenHeight = 0

    for (const block of scanned) {
      if (block.minerAddress === trimmed) {
        minedBlocks += 1
        lastSeenHeight = Math.max(lastSeenHeight, block.height)
      }

      for (const tx of block.transactions) {
        if (!tx || typeof tx !== 'object') continue
        const txData = tx as GenericRecord
        const fromSide = txData.from
        const toSide = txData.to
        const fromAddresses = addressFromTxSide(fromSide)
        const toAddresses = addressFromTxSide(toSide)
        const involved = fromAddresses.includes(trimmed) || toAddresses.includes(trimmed)
        if (!involved) continue

        txCount += 1
        totalOut += amountFromTxSideForAddress(fromSide, trimmed)
        totalIn += amountFromTxSideForAddress(toSide, trimmed)
        lastSeenHeight = Math.max(lastSeenHeight, block.height)
      }
    }

    return {
      address: trimmed,
      minedBlocks,
      transactionsCount: txCount,
      totalIn,
      totalOut,
      netAmount: totalIn - totalOut,
      lastSeenHeight,
      source: 'recent-block-scan',
    }
  }
}

export async function fetchAddressTxs(address: string): Promise<GenericRecord[]> {
  const trimmed = address.trim()
  try {
    const response = await api.get(`/address-txs/${encodeURIComponent(trimmed)}`)
    if (Array.isArray(response.data)) return response.data as GenericRecord[]

    const data = response.data as Record<string, unknown>
    if (Array.isArray(data?.transactions)) return safeArray(data.transactions)
    if (Array.isArray(data?.txs)) return safeArray(data.txs)

    return []
  } catch {
    const scanned = await getRecentBlocks(450)
    const results: GenericRecord[] = []

    for (const block of scanned) {
      for (const tx of block.transactions) {
        if (!tx || typeof tx !== 'object') continue
        const txData = tx as GenericRecord
        const fromSide = txData.from
        const toSide = txData.to

        const fromAddresses = addressFromTxSide(fromSide)
        const toAddresses = addressFromTxSide(toSide)
        const involved = fromAddresses.includes(trimmed) || toAddresses.includes(trimmed)
        if (!involved) continue

        const amountIn = amountFromTxSideForAddress(toSide, trimmed)
        const amountOut = amountFromTxSideForAddress(fromSide, trimmed)

        results.push({
          txId: txIdFromUnknown(txData),
          fromAddress: fromAddresses[0] ?? '-',
          toAddress: toAddresses[0] ?? '-',
          amount: amountIn > 0 ? amountIn : -amountOut,
          blockHeight: block.height,
          blockHash: block.hash,
          timestamp: block.timestamp,
        })
      }
    }

    return results
  }
}
