import axios from 'axios'

export type EndpointProbe = {
  path: string
  ok: boolean
  statusCode?: number
  error?: string
}

export type NetworkPeer = {
  key: string
  address: string
  port: string
  raw: Record<string, unknown>
}

export type NetworkOverview = {
  observedPeers: number
  estimatedOnlineNodes: number | null
  confidence: 'low' | 'medium' | 'high'
  sourcePath: string | null
  probes: EndpointProbe[]
  peers: NetworkPeer[]
  note: string
}

const api = axios.create({
  baseURL: '/api',
  timeout: 12000,
})

const CANDIDATE_PATHS = [
  '/peers',
  '/nodes',
  '/network/peers',
  '/network/nodes',
  '/connections',
]

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

const toArrayOfRecords = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
}

const extractPeers = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return toArrayOfRecords(payload)

  const data = asRecord(payload)
  if (!data) return []

  const candidates = [data.peers, data.nodes, data.connections, data.result, data.data]
  for (const candidate of candidates) {
    const parsed = toArrayOfRecords(candidate)
    if (parsed.length > 0) return parsed
  }

  return []
}

const readAddress = (peer: Record<string, unknown>): string => {
  const value = peer.address ?? peer.ip ?? peer.host ?? peer.remoteAddress ?? ''
  return String(value ?? '').trim()
}

const readPort = (peer: Record<string, unknown>): string => {
  const value = peer.port ?? peer.remotePort ?? peer.p2pPort ?? ''
  const rendered = String(value ?? '').trim()
  return rendered || '-'
}

const estimateTotalFromObserved = (observedPeers: number): number | null => {
  if (observedPeers <= 0) return null
  if (observedPeers < 20) return Math.round(observedPeers * 1.8)
  if (observedPeers < 100) return Math.round(observedPeers * 1.45)
  return Math.round(observedPeers * 1.25)
}

export async function fetchNetworkOverview(): Promise<NetworkOverview> {
  const probes: EndpointProbe[] = []

  for (const path of CANDIDATE_PATHS) {
    try {
      const response = await api.get(path)
      const peerRecords = extractPeers(response.data)

      probes.push({
        path,
        ok: true,
        statusCode: response.status,
      })

      if (peerRecords.length === 0) {
        continue
      }

      const dedupe = new Map<string, NetworkPeer>()
      for (const item of peerRecords) {
        const address = readAddress(item)
        if (!address) continue

        const port = readPort(item)
        const key = `${address}:${port}`
        if (!dedupe.has(key)) {
          dedupe.set(key, { key, address, port, raw: item })
        }
      }

      const peers = [...dedupe.values()]
      const observedPeers = peers.length
      const estimatedOnlineNodes = estimateTotalFromObserved(observedPeers)

      return {
        observedPeers,
        estimatedOnlineNodes,
        confidence: observedPeers >= 60 ? 'high' : observedPeers >= 20 ? 'medium' : 'low',
        sourcePath: path,
        probes,
        peers,
        note:
          'Estimated online nodes are heuristic values from one node view and are not an exact full-network count.',
      }
    } catch (error: unknown) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined
      probes.push({
        path,
        ok: false,
        statusCode,
        error: axios.isAxiosError(error) ? (error.message || 'request failed') : 'request failed',
      })
    }
  }

  return {
    observedPeers: 0,
    estimatedOnlineNodes: null,
    confidence: 'low',
    sourcePath: null,
    probes,
    peers: [],
    note:
      'No peers endpoint is currently exposed by backend API. Add /api/peers (or /api/nodes) to enable real-time estimates.',
  }
}