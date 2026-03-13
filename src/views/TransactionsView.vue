<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchTransaction, type GenericRecord } from '../services/explorerApi'

const txId = ref('')
const loading = ref(false)
const error = ref('')
const transaction = ref<GenericRecord | null>(null)
const route = useRoute()
const router = useRouter()

const fromAddress = computed(() => {
  const data = transaction.value ?? {}
  return String(data.fromAddress ?? data.from ?? '').trim()
})

const toAddress = computed(() => {
  const data = transaction.value ?? {}
  return String(data.toAddress ?? data.to ?? '').trim()
})

const amount = computed(() => String((transaction.value ?? {}).amount ?? '-'))
const hash = computed(() => String((transaction.value ?? {}).hash ?? (transaction.value ?? {}).txId ?? txId.value))

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

const searchTx = async () => {
  await runSearch(txId.value, true)
}

const hydrateFromRoute = async () => {
  const routeTxId = route.params.txId
  if (typeof routeTxId !== 'string' || !routeTxId.trim()) return
  await runSearch(routeTxId, false)
}

onMounted(async () => {
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
        <p>Search transaction details by tx id.</p>
      </div>
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
              <RouterLink v-if="fromAddress" :to="`/address/${fromAddress}`" class="explorer-link">{{ fromAddress }}</RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>To</th>
            <td class="truncate">
              <RouterLink v-if="toAddress" :to="`/address/${toAddress}`" class="explorer-link">{{ toAddress }}</RouterLink>
              <span v-else>-</span>
            </td>
          </tr>
          <tr>
            <th>Amount</th>
            <td>{{ amount }}</td>
          </tr>
        </tbody>
      </table>

      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre class="json-box">{{ JSON.stringify(transaction, null, 2) }}</pre>
      </details>
    </section>
  </section>
</template>
