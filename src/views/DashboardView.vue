<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchChain, fetchLatestBlocks, type GenericRecord } from '../services/explorerApi'

const loading = ref(true)
const error = ref('')
const chain = ref<Record<string, unknown>>({})
const blocks = ref<GenericRecord[]>([])

let intervalId: number | undefined

const metrics = computed(() => {
  const height = Number(chain.value.height ?? 0)
  const txCount = Number(chain.value.transactionsCount ?? 0)
  const syncing = Boolean(chain.value.syncing)

  return [
    { label: 'Chain Height', value: height.toLocaleString() },
    { label: 'Transactions', value: txCount.toLocaleString() },
    { label: 'Sync Status', value: syncing ? 'Syncing' : 'Synced' },
    { label: 'Latest Block Hash', value: String(chain.value.hash ?? '-').slice(0, 14) + '...' },
  ]
})

const refresh = async () => {
  try {
    error.value = ''
    const [chainData, blocksData] = await Promise.all([fetchChain(), fetchLatestBlocks()])
    chain.value = chainData
    blocks.value = blocksData.slice(0, 8)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load dashboard data.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refresh()
  intervalId = window.setInterval(refresh, 10000)
})

onUnmounted(() => {
  if (intervalId) window.clearInterval(intervalId)
})
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Dashboard</h1>
        <p>Live network state and latest blocks.</p>
      </div>
      <button class="ghost-btn" @click="refresh">Refresh</button>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <div class="metrics-grid">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <p class="metric-label">{{ metric.label }}</p>
        <p class="metric-value">{{ metric.value }}</p>
      </article>
    </div>

    <section class="panel">
      <h2>Latest Blocks</h2>
      <p v-if="loading">Loading latest blocks...</p>
      <p v-else-if="blocks.length === 0">No blocks available yet.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Height</th>
            <th>Hash</th>
            <th>Miner</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="block in blocks" :key="String(block.hash ?? block.height)">
            <td>{{ block.height ?? '-' }}</td>
            <td class="truncate">
              <RouterLink
                v-if="block.hash"
                :to="`/block/${String(block.hash)}`"
                class="explorer-link"
              >
                {{ block.hash }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="block.minerAddress"
                :to="`/address/${String(block.minerAddress)}`"
                class="explorer-link"
              >
                {{ block.minerAddress }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td>{{ block.transactions ? (Array.isArray(block.transactions) ? block.transactions.length : '-') : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
