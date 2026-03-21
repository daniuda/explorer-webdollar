<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchMarkets, fetchPools, findLastMinedBlocksForPools, type MarketSummary, type PoolSummary } from '../services/poolsApi'
import { formatAddressDisplay } from '../utils/addressFormat'
import { formatAbsoluteTime, formatTimeAgo } from '../utils/timeFormat'
import { formatWebdAmount } from '../utils/webdAmount'

const loading = ref(false)
const scanningLastMined = ref(false)
const error = ref('')
const pools = ref<PoolSummary[]>([])
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

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    const [marketData, poolData] = await Promise.all([fetchMarkets(), fetchPools()])
    markets.value = marketData
    pools.value = poolData
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
  void refresh()
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
          <span v-else-if="pool.lastMinedBlock?.stale" style="font-size:0.75rem;font-weight:400;color:#888;margin-left:0.5rem;">(negăsit în ultimele 200 blocuri – afișez ultimul cunoscut)</span>
        </h3>
        <div class="pool-stats-grid">
          <div class="pool-stat-card">
            <p class="metric-label">Block</p>
            <p class="metric-value">
              {{ pool.lastMinedBlock ? `#${pool.lastMinedBlock.height} (${shortHash(pool.lastMinedBlock.hash)})` : 'N/A' }}
            </p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Mined at</p>
            <p class="metric-value">{{ pool.lastMinedBlock ? formatAbsoluteTime(pool.lastMinedBlock.timestamp) : 'N/A' }}</p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Ago</p>
            <p class="metric-value">{{ pool.lastMinedBlock ? formatTimeAgo(pool.lastMinedBlock.timestamp) : 'N/A' }}</p>
          </div>
          <div class="pool-stat-card">
            <p class="metric-label">Reward</p>
            <p class="metric-value">
              {{ pool.lastMinedBlock ? formatWebdAmount(pool.lastMinedBlock.rewardWebd, { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : 'N/A' }}
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
