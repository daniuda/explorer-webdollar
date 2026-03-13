<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBlockByParam, fetchLatestBlocks, type GenericRecord } from '../services/explorerApi'

const loading = ref(false)
const error = ref('')
const query = ref('')
const latest = ref<GenericRecord[]>([])
const selected = ref<GenericRecord | null>(null)
const route = useRoute()
const router = useRouter()

const selectedTxs = computed(() => {
  const txs = selected.value?.transactions
  return Array.isArray(txs) ? txs : []
})

const loadLatest = async () => {
  loading.value = true
  error.value = ''
  try {
    latest.value = await fetchLatestBlocks()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Cannot load blocks.'
  } finally {
    loading.value = false
  }
}

const runBlockSearch = async (rawParam: string, updateRoute: boolean) => {
  const trimmed = rawParam.trim()
  if (!trimmed) return

  loading.value = true
  error.value = ''
  try {
    selected.value = await fetchBlockByParam(trimmed)

    if (updateRoute) {
      await router.push(`/block/${encodeURIComponent(trimmed)}`)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Block not found.'
    selected.value = null
  } finally {
    loading.value = false
  }
}

const searchBlock = async () => {
  await runBlockSearch(query.value, true)
}

const hydrateFromRoute = async () => {
  const routeParam = route.params.param
  if (typeof routeParam !== 'string' || !routeParam.trim()) return
  query.value = routeParam
  await runBlockSearch(routeParam, false)
}

onMounted(async () => {
  await loadLatest()
  await hydrateFromRoute()
})

watch(
  () => route.params.param,
  async () => {
    await hydrateFromRoute()
  },
)
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Blocks</h1>
        <p>Browse latest blocks or search by height/hash.</p>
      </div>
      <button class="ghost-btn" @click="loadLatest">Reload</button>
    </header>

    <div class="search-row">
      <input v-model="query" placeholder="Block height or hash" class="search-input" @keyup.enter="searchBlock" />
      <button class="primary-btn" @click="searchBlock">Search</button>
    </div>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <section v-if="selected" class="panel">
      <h2>Search Result</h2>
      <table class="data-table">
        <tbody>
          <tr>
            <th>Height</th>
            <td>{{ selected.height ?? '-' }}</td>
          </tr>
          <tr>
            <th>Hash</th>
            <td class="truncate">
              <span>{{ selected.hash ?? '-' }}</span>
            </td>
          </tr>
          <tr>
            <th>Miner</th>
            <td class="truncate">
              <RouterLink
                v-if="selected.minerAddress"
                :to="`/address/${String(selected.minerAddress)}`"
                class="explorer-link"
              >
                {{ selected.minerAddress }}
              </RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>Timestamp</th>
            <td>{{ selected.timestamp ?? selected.timeStamp ?? '-' }}</td>
          </tr>
        </tbody>
      </table>

      <section v-if="selectedTxs.length > 0" class="inline-panel">
        <h3>Transactions</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in selectedTxs" :key="String(tx)">
              <td class="truncate">
                <RouterLink :to="`/tx/${String(tx)}`" class="explorer-link">{{ tx }}</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>

    <section class="panel">
      <h2>Latest Blocks</h2>
      <p v-if="loading">Loading...</p>
      <p v-else-if="latest.length === 0">No blocks to show.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Height</th>
            <th>Hash</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="block in latest" :key="String(block.hash ?? block.height)">
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
            <td>{{ block.timestamp ?? block.timeStamp ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
