<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchMarkets, fetchPools, type MarketSummary, type PoolSummary } from '../services/poolsApi'

const loading = ref(false)
const error = ref('')
const pools = ref<PoolSummary[]>([])
const markets = ref<MarketSummary>({ webdUsdt: 0, webdEth: 0 })

const formatNumber = (value: number, decimals = 2): string =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const marketCards = computed(() => [
  { label: 'Indoex WEBD / USDT (1M WEBD)', value: `${formatNumber(markets.value.webdUsdt * 1_000_000, 2)} USDT` },
  { label: 'Indoex WEBD / ETH (1M WEBD)', value: `${formatNumber(markets.value.webdEth * 1_000_000, 8)} ETH` },
])

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
        <p>Pool stats + miners list (iudaWEBD, Spyclub).</p>
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
          <p class="metric-value">{{ formatNumber(pool.totalPosWebd * markets.webdUsdt, 2) }} USD</p>
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
              <RouterLink :to="`/address/${miner.address}`" class="explorer-link">{{ miner.address }}</RouterLink>
            </td>
            <td>{{ formatNumber(miner.balance, 4) }}</td>
            <td>{{ formatNumber(miner.balance * markets.webdUsdt, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
