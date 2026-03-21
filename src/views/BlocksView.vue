<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBlockByParam, fetchLatestBlocks, type GenericRecord } from '../services/explorerApi'
import { formatAddressDisplay } from '../utils/addressFormat'
import { formatTimeAgo } from '../utils/timeFormat'
import { formatWebdAmount } from '../utils/webdAmount'

const loading = ref(false)
const error = ref('')
const query = ref('')
const latest = ref<GenericRecord[]>([])
const selected = ref<GenericRecord | null>(null)
const nowTick = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null
const route = useRoute()
const router = useRouter()
const encodeParam = (value: string) => encodeURIComponent(value)

const formatAgo = (value: unknown): string => {
  // Depend on clock to update elapsed labels in real-time.
  void nowTick.value
  return formatTimeAgo(value)
}

const txIdFromEntry = (tx: unknown): string => {
  if (typeof tx === 'string') return tx
  if (!tx || typeof tx !== 'object') return ''
  const data = tx as GenericRecord
  return String(data.txId ?? data.hash ?? data.id ?? '')
}

const txAmountFromEntry = (tx: unknown): unknown => {
  if (!tx || typeof tx !== 'object') return null
  const data = tx as GenericRecord

  if (Array.isArray(data.to) && data.to.length > 0 && typeof data.to[0] === 'object') {
    return (data.to[0] as GenericRecord).amount
  }

  return data.amount ?? null
}

const formatBlockAmount = (value: unknown) => formatWebdAmount(value)

const selectedTxs = computed(() => {
  const txs = selected.value?.transactions
  return Array.isArray(txs) ? txs : []
})

const selectedDataLevel1 = computed<GenericRecord>(() => {
  const raw = selected.value
  if (!raw || typeof raw !== 'object') return {}
  const level1 = (raw as GenericRecord).data
  return level1 && typeof level1 === 'object' ? (level1 as GenericRecord) : (raw as GenericRecord)
})

const selectedDataLevel2 = computed<GenericRecord>(() => {
  const level1 = selectedDataLevel1.value
  const level2 = level1.data
  return level2 && typeof level2 === 'object' ? (level2 as GenericRecord) : level1
})

const selectedPowPos = computed(() => {
  const posMinerAddress = String(selectedDataLevel1.value.posMinerAddress ?? '').trim()
  return posMinerAddress ? 'POS' : 'POW'
})

const selectedVersion = computed(() => selectedDataLevel1.value.version ?? '-')
const selectedHashPrev = computed(() => String(selectedDataLevel1.value.hashPrev ?? selected.value?.hashPrev ?? '').trim())
const selectedHashChainPrev = computed(() => String(selectedDataLevel1.value.hashChainPrev ?? '-'))
const selectedNonce = computed(() => selectedDataLevel1.value.nonce ?? '-')
const selectedDifficulty = computed(() => selectedDataLevel1.value.difficulty ?? '-')
const selectedHashChain = computed(() => selectedDataLevel1.value.hashChain ?? '-')
const selectedReward = computed(() => formatWebdAmount(selected.value?.rewardWebd ?? selectedDataLevel1.value.reward))
const selectedTotalWebd = computed(() => formatWebdAmount(selected.value?.totalWebd))
const selectedResolvedBy = computed(() => selectedDataLevel1.value.resolvedBy ?? selectedDataLevel2.value.resolvedBy ?? '-')

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
  clockTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)

  await loadLatest()
  await hydrateFromRoute()
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = null
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
      <p>Viewing block: {{ selected.height ?? '-' }}</p>
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
            <th>POW/POS</th>
            <td>{{ selectedPowPos }}</td>
          </tr>
          <tr>
            <th>Version</th>
            <td>{{ selectedVersion }}</td>
          </tr>
          <tr>
            <th>Hash Prev</th>
            <td class="truncate">
              <RouterLink
                v-if="selectedHashPrev"
                :to="`/block/${encodeParam(selectedHashPrev)}`"
                class="explorer-link"
              >
                {{ selectedHashPrev }}
              </RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>Hash Chain Prev</th>
            <td class="truncate">{{ selectedHashChainPrev }}</td>
          </tr>
          <tr>
            <th>Miner</th>
            <td class="truncate">
              <RouterLink
                v-if="selected.minerAddress"
                :to="`/address/${encodeParam(formatAddressDisplay(selected.minerAddress))}`"
                class="explorer-link"
              >
                {{ formatAddressDisplay(selected.minerAddress) }}
              </RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>Nonce</th>
            <td>{{ selectedNonce }}</td>
          </tr>
          <tr>
            <th>Timp trecut</th>
            <td>{{ formatAgo(selected.timestamp ?? selected.timeStamp) }}</td>
          </tr>
          <tr>
            <th>Difficulty</th>
            <td class="truncate">{{ selectedDifficulty }}</td>
          </tr>
          <tr>
            <th>Hash Chain</th>
            <td class="truncate">{{ selectedHashChain }}</td>
          </tr>
          <tr>
            <th>Reward</th>
            <td>{{ selectedReward }}</td>
          </tr>
          <tr>
            <th>Total WEBD in Block</th>
            <td>{{ selectedTotalWebd }}</td>
          </tr>
          <tr>
            <th>Resolved By</th>
            <td>{{ selectedResolvedBy }}</td>
          </tr>
          <tr>
            <th>Transactions</th>
            <td>{{ selectedTxs.length }}</td>
          </tr>
        </tbody>
      </table>

      <section v-if="selectedTxs.length > 0" class="inline-panel">
        <h3>Transactions</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Tx</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(tx, index) in selectedTxs" :key="txIdFromEntry(tx) || String(index)">
              <td class="truncate">
                <RouterLink v-if="txIdFromEntry(tx)" :to="`/tx/${encodeParam(txIdFromEntry(tx))}`" class="explorer-link">{{ txIdFromEntry(tx) }}</RouterLink>
                <span v-else>-</span>
              </td>
              <td>{{ formatWebdAmount(txAmountFromEntry(tx)) }}</td>
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
            <th>Miner</th>
            <th>Total WEBD</th>
            <th>Timp trecut</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="block in latest" :key="String(block.hash ?? block.height)">
            <td>{{ block.height ?? '-' }}</td>
            <td class="truncate">
              <RouterLink
                v-if="block.hash"
                :to="`/block/${encodeParam(String(block.hash))}`"
                class="explorer-link"
              >
                {{ block.hash }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="block.minerAddress"
                :to="`/address/${encodeParam(formatAddressDisplay(block.minerAddress))}`"
                class="explorer-link"
              >
                {{ formatAddressDisplay(block.minerAddress) }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td>{{ formatBlockAmount(block.totalWebd) }}</td>
            <td>{{ formatAgo(block.timestamp ?? block.timeStamp) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
