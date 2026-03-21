<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchMarkets, fetchPools, findLastMinedBlocksForPools, type MarketSummary, type PoolSummary } from '../services/poolsApi'
import { formatAddressDisplay } from '../utils/addressFormat'
import { formatAbsoluteTime, formatTimeAgo } from '../utils/timeFormat'
import { formatWebdAmount } from '../utils/webdAmount'

const loading = ref(false)
const scanningLastMined = ref(false)
const error = ref('')
const pools = ref<PoolSummary[]>([])
const nowTick = ref(Date.now())
const lastPaidMap = ref<Record<string, { blocksPaid: number; detectedAtMs: number }>>({})
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
const markets = ref<MarketSummary>({
  webdUsdt: 0,
  webdVd: 0,
  vdUsdt: 0,
  webdUsd: 0,
  webdUsdFromVd: 0,
  usdComputedAt: '',
})
const encodeParam = (value: string) => encodeURIComponent(value)
const shortHash = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length <= 14) return trimmed || '-'
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`
}

const formatNumber = (value: number, decimals = 2): string =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const marketCards = computed(() => [
  { label: 'Vindax WEBD / USDT (1M WEBD)', value: `${formatNumber(markets.value.webdUsdt * 1_000_000, 2)} USDT` },
  { label: 'Vindax WEBD / VD (1M WEBD)', value: `${formatNumber(markets.value.webdVd * 1_000_000, 2)} VD` },
  { label: 'Vindax VD / USDT (daily cache)', value: `${formatNumber(markets.value.vdUsdt, 6)} USDT` },
  { label: 'Derived WEBD / USD (1M WEBD)', value: `${formatNumber(markets.value.webdUsd * 1_000_000, 2)} USD` },
])

const conversionTimeLabel = computed(() => {
  if (!markets.value.usdComputedAt) return '-'
  const date = new Date(markets.value.usdComputedAt)
  if (Number.isNaN(date.getTime())) return markets.value.usdComputedAt
  return date.toLocaleString('ro-RO')
})

const LAST_PAID_CACHE_KEY = 'webdExplorer.poolLastPaidByBlocksPaid.v1'

const loadLastPaidCache = (): Record<string, { blocksPaid: number; detectedAtMs: number }> => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LAST_PAID_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { blocksPaid: number; detectedAtMs: number }>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

const saveLastPaidCache = (value: Record<string, { blocksPaid: number; detectedAtMs: number }>): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_PAID_CACHE_KEY, JSON.stringify(value))
  } catch {
    // Ignore storage write issues.
  }
}

const updateLastPaidByStats = (poolData: PoolSummary[]): void => {
  const next = { ...lastPaidMap.value }
  const now = Date.now()

  for (const pool of poolData) {
    const currentPaid = Number(pool.stats.blocksPaid || 0)
    const prev = next[pool.name]

    if (!prev) {
      next[pool.name] = { blocksPaid: currentPaid, detectedAtMs: now }
      continue
    }

    if (currentPaid > prev.blocksPaid || currentPaid < prev.blocksPaid) {
      next[pool.name] = { blocksPaid: currentPaid, detectedAtMs: now }
      continue
    }

    next[pool.name] = prev
  }

  lastPaidMap.value = next
  saveLastPaidCache(next)
}

const estimatedLastPaidAgo = (poolName: string): string => {
  // Depend on reactive clock so text updates live every second.
  void nowTick.value
  const state = lastPaidMap.value[poolName]
  if (!state || !Number.isFinite(state.detectedAtMs) || state.detectedAtMs <= 0) return 'display soon...'
  return formatTimeAgo(state.detectedAtMs)
}

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    const [marketData, poolData] = await Promise.all([fetchMarkets(), fetchPools()])
    markets.value = marketData
    pools.value = poolData
    updateLastPaidByStats(poolData)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Cannot load pools data.'
  } finally {
    loading.value = false
  }
  // Scan for last mined blocks in background after pools are already visible.
  scanningLastMined.value = true
  try {
    const lastMinedMap = await findLastMinedBlocksForPools(
      pools.value.map((p) => ({ name: p.name, miners: p.miners })),
    )
    // Only update pools that have newly found data (don't lose cache on timeout)
    pools.value = pools.value.map((pool) => ({
      ...pool,
      lastMinedBlock: lastMinedMap[pool.name] !== undefined ? lastMinedMap[pool.name] : pool.lastMinedBlock,
    }))
  } catch {
    // Silently ignore scan errors; cached values remain.
  } finally {
    scanningLastMined.value = false
  }
}

onMounted(() => {
  lastPaidMap.value = loadLastPaidCache()
  void refresh()

  clockTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)

  autoRefreshTimer = setInterval(() => {
    void refresh()
  }, 30000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
  clockTimer = null
  autoRefreshTimer = null
})
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Pools</h1>
        <p>Pool stats + miners list (iudaWEBD, Spyclub, Timi).</p>
      </div>
      <button class="ghost-btn" @click="refresh">Reload</button>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <div class="metrics-grid">
      <article v-for="card in marketCards" :key="card.label" class="metric-card">
        <p class="metric-label">{{ card.label }}</p>
        <p class="metric-value">{{ card.value }}</p>
      </article>
    </div>

    <p class="metric-label">VD -> USDT conversion cached at: {{ conversionTimeLabel }}</p>

    <p v-if="loading">Loading pools...</p>

    <section v-for="pool in pools" :key="pool.name" class="panel">
      <h2>{{ pool.name }}</h2>

      <div class="pool-stats-grid">
        <div class="pool-stat-card">
          <p class="metric-label">Total POS</p>
          <p class="metric-value">{{ formatNumber(pool.totalPosWebd, 2) }} WEBD</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Value USD</p>
          <p class="metric-value">{{ formatNumber(pool.totalPosWebd * markets.webdUsd, 2) }} USD</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Online Miners</p>
          <p class="metric-value">{{ pool.stats.onlineMiners }}</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Blocks Paid</p>
          <p class="metric-value">{{ pool.stats.blocksPaid }}</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Estimare ultimul block (după Blocks Paid)</p>
          <p class="metric-value">{{ estimatedLastPaidAgo(pool.name) }}</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Blocks Unpaid</p>
          <p class="metric-value">{{ pool.stats.blocksUnpaid }}</p>
        </div>
        <div class="pool-stat-card">
          <p class="metric-label">Being Confirmed</p>
          <p class="metric-value">{{ pool.stats.blocksBeingConfirmed }}</p>
        </div>
      </div>

      <section class="panel" style="margin-top: 1rem;">
        <h3>Last mined
          <span v-if="scanningLastMined" style="font-size:0.75rem;font-weight:400;color:#888;margin-left:0.5rem;">se caută...</span>
          <span v-else-if="pool.lastMinedBlock?.stale" style="font-size:0.75rem;font-weight:400;color:#888;margin-left:0.5rem;">(date cache; se caută sursă mai bună)</span>
          <span v-else-if="!pool.lastMinedBlock" style="font-size:0.75rem;font-weight:400;color:#888;margin-left:0.5rem;">display soon...</span>
        </h3>
        <div class="pool-stats-grid">
          <div class="pool-stat-card">
            <p class="metric-label">Block</p>
            <p class="metric-value">
              {{ pool.lastMinedBlock ? `#${pool.lastMinedBlock.height} (${shortHash(pool.lastMinedBlock.hash)})` : 'display soon...' }}
            </p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Mined at</p>
            <p class="metric-value">{{ pool.lastMinedBlock ? formatAbsoluteTime(pool.lastMinedBlock.timestamp) : 'display soon...' }}</p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Ago</p>
            <p class="metric-value">{{ pool.lastMinedBlock ? formatTimeAgo(pool.lastMinedBlock.timestamp) : 'display soon...' }}</p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Reward</p>
            <p class="metric-value">
              {{ pool.lastMinedBlock ? formatWebdAmount(pool.lastMinedBlock.rewardWebd, { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : 'display soon...' }}
            </p>
          </div>
        </div>
      </section>

      <table class="data-table">
        <thead>
          <tr>
            <th>Miner</th>
            <th>Balance</th>
            <th>USD</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="miner in pool.miners" :key="`${pool.name}-${miner.address}-${miner.balance}`">
            <td class="truncate">
              <RouterLink :to="`/address/${encodeParam(formatAddressDisplay(miner.address))}`" class="explorer-link">{{ formatAddressDisplay(miner.address) }}</RouterLink>
            </td>
            <td>{{ formatNumber(miner.balance, 4) }}</td>
            <td>{{ formatNumber(miner.balance * markets.webdUsd, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
