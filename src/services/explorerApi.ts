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

export async function fetchChain(): Promise<ChainResponse> {
  const response = await api.get('/chain')
  return response.data as ChainResponse
}

export async function fetchLatestBlocks(): Promise<GenericRecord[]> {
  const data = await firstSuccessful<unknown>([
    async () => (await api.get('/blocks')).data,
    async () => (await api.get('/blocks/1')).data,
    async () => (await api.get('/blocks/0')).data,
  ])

  return parseBlocksPayload(data)
}

export async function fetchBlockByParam(param: string): Promise<GenericRecord> {
  const response = await api.get(`/block/${encodeURIComponent(param)}`)
  return (response.data ?? {}) as GenericRecord
}

export async function fetchTransaction(txId: string): Promise<GenericRecord> {
  const response = await api.get(`/tx/${encodeURIComponent(txId)}`)
  return (response.data ?? {}) as GenericRecord
}

export async function fetchAddress(address: string): Promise<GenericRecord> {
  const response = await api.get(`/address/${encodeURIComponent(address)}`)
  return (response.data ?? {}) as GenericRecord
}

export async function fetchAddressTxs(address: string): Promise<GenericRecord[]> {
  const response = await api.get(`/address-txs/${encodeURIComponent(address)}`)
  if (Array.isArray(response.data)) return response.data as GenericRecord[]

  const data = response.data as Record<string, unknown>
  if (Array.isArray(data?.transactions)) return safeArray(data.transactions)
  if (Array.isArray(data?.txs)) return safeArray(data.txs)

  return []
}
