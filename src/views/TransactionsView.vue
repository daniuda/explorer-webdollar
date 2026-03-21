<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLatestTransactions, fetchTransaction, type GenericRecord } from '../services/explorerApi'
import { formatAddressDisplay } from '../utils/addressFormat'
import { formatWebdAmount } from '../utils/webdAmount'
import { formatAbsoluteTime, formatTimeAgo } from '../utils/timeFormat'

const txId = ref('')
const loading = ref(false)
const error = ref('')
const transaction = ref<GenericRecord | null>(null)
const latestLoading = ref(false)
const latest = ref<GenericRecord[]>([])
const route = useRoute()
const router = useRouter()
const encodeParam = (value: string) => encodeURIComponent(value)

const firstAddress = (side: unknown): string => {
  if (!Array.isArray(side) || side.length === 0) return ''
  const first = side[0]
  if (!first || typeof first !== 'object') return ''
  return String((first as GenericRecord).address ?? '')
}

const fromAddress = computed(() => {
  const data = transaction.value ?? {}
  const fromSide = data.from
  const parsed = firstAddress(fromSide)
  return String(data.fromAddress ?? parsed ?? data.from ?? '').trim()
})

const toAddress = computed(() => {
  const data = transaction.value ?? {}
  const toSide = data.to
  const parsed = firstAddress(toSide)
  return String(data.toAddress ?? parsed ?? data.to ?? '').trim()
})

const amount = computed(() => formatWebdAmount((transaction.value ?? {}).amount))
const hash = computed(() => String((transaction.value ?? {}).hash ?? (transaction.value ?? {}).txId ?? txId.value))
const transactionTimestamp = computed(() => (transaction.value ?? {}).timestamp ?? (transaction.value ?? {}).timeStamp)

const runSearch = async (rawTxId: string, updateRoute: boolean) => {
  const trimmed = rawTxId.trim()
  if (!trimmed) return

  txId.value = trimmed
  loading.value = true
  error.value = ''
  transaction.value = null

  try {
    transaction.value = await fetchTransaction(trimmed)
    if (updateRoute) {
      await router.push(`/tx/${encodeURIComponent(trimmed)}`)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Transaction not found.'
  } finally {
    loading.value = false
  }
}

const loadLatest = async () => {
  latestLoading.value = true
  try {
    latest.value = await fetchLatestTransactions(10)
  } finally {
    latestLoading.value = false
  }
}

const searchTx = async () => {
  await runSearch(txId.value, true)
}

const hydrateFromRoute = async () => {
  const routeTxId = route.params.txId
  if (typeof routeTxId !== 'string' || !routeTxId.trim()) return
  await runSearch(routeTxId, false)
}

onMounted(async () => {
  await loadLatest()
  await hydrateFromRoute()
})

watch(
  () => route.params.txId,
  async () => {
    await hydrateFromRoute()
  },
)
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Transactions</h1>
        <p>Search by tx id and browse latest 10 transactions.</p>
      </div>
      <button class="ghost-btn" @click="loadLatest">Reload</button>
    </header>

    <div class="search-row">
      <input v-model="txId" placeholder="Transaction ID" class="search-input" @keyup.enter="searchTx" />
      <button class="primary-btn" @click="searchTx">Search</button>
    </div>

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="loading">Loading transaction...</p>

    <section v-if="transaction" class="panel">
      <h2>Transaction Details</h2>
      <table class="data-table">
        <tbody>
          <tr>
            <th>Tx Id</th>
            <td class="truncate">{{ hash }}</td>
          </tr>
          <tr>
            <th>From</th>
            <td class="truncate">
              <RouterLink v-if="fromAddress" :to="`/address/${encodeParam(formatAddressDisplay(fromAddress))}`" class="explorer-link">{{ formatAddressDisplay(fromAddress) }}</RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>To</th>
            <td class="truncate">
              <RouterLink v-if="toAddress" :to="`/address/${encodeParam(formatAddressDisplay(toAddress))}`" class="explorer-link">{{ formatAddressDisplay(toAddress) }}</RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>Amount</th>
            <td>{{ amount }}</td>
          </tr>
          <tr>
            <th>When</th>
            <td>{{ formatAbsoluteTime(transactionTimestamp) }}</td>
          </tr>
          <tr>
            <th>Time Ago</th>
            <td>{{ formatTimeAgo(transactionTimestamp) }}</td>
          </tr>
        </tbody>
      </table>

      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre class="json-box">{{ JSON.stringify(transaction, null, 2) }}</pre>
      </details>
    </section>

    <section class="panel">
      <h2>Latest 10 Transactions</h2>
      <p v-if="latestLoading">Loading latest transactions...</p>
      <p v-else-if="latest.length === 0">No transactions to show.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Tx</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Block</th>
            <th>When</th>
            <th>Time Ago</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in latest" :key="String(tx.txId)">
            <td class="truncate">
              <RouterLink :to="`/tx/${encodeParam(String(tx.txId))}`" class="explorer-link">{{ tx.txId }}</RouterLink>
            </td>
            <td class="truncate">
              <RouterLink v-if="tx.fromAddress && tx.fromAddress !== '-'" :to="`/address/${encodeParam(formatAddressDisplay(tx.fromAddress))}`" class="explorer-link">{{ formatAddressDisplay(tx.fromAddress) }}</RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink v-if="tx.toAddress && tx.toAddress !== '-'" :to="`/address/${encodeParam(formatAddressDisplay(tx.toAddress))}`" class="explorer-link">{{ formatAddressDisplay(tx.toAddress) }}</RouterLink>
              <span v-else>-</span>
            </td>
            <td>{{ formatWebdAmount(tx.amount) }}</td>
            <td>{{ tx.blockHeight ?? '-' }}</td>
            <td>{{ formatAbsoluteTime(tx.timestamp ?? tx.timeStamp) }}</td>
            <td>{{ formatTimeAgo(tx.timestamp ?? tx.timeStamp) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
