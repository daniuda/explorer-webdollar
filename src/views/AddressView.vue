<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAddress, fetchAddressTxs, type GenericRecord } from '../services/explorerApi'

const address = ref('')
const loading = ref(false)
const error = ref('')
const addressInfo = ref<GenericRecord | null>(null)
const transactions = ref<GenericRecord[]>([])
const route = useRoute()
const router = useRouter()

const runSearch = async (rawAddress: string, updateRoute: boolean) => {
  const trimmed = rawAddress.trim()
  if (!trimmed) return

  address.value = trimmed

  loading.value = true
  error.value = ''
  addressInfo.value = null
  transactions.value = []

  try {
    const [info, txs] = await Promise.all([
      fetchAddress(trimmed),
      fetchAddressTxs(trimmed),
    ])
    addressInfo.value = info
    transactions.value = txs
    if (updateRoute) {
      await router.push(`/address/${encodeURIComponent(trimmed)}`)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Address not found.'
  } finally {
    loading.value = false
  }
}

const searchAddress = async () => {
  await runSearch(address.value, true)
}

const hydrateFromRoute = async () => {
  const routeAddress = route.params.address
  if (typeof routeAddress !== 'string' || !routeAddress.trim()) return
  await runSearch(routeAddress, false)
}

onMounted(async () => {
  await hydrateFromRoute()
})

watch(
  () => route.params.address,
  async () => {
    await hydrateFromRoute()
  },
)
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Address</h1>
        <p>Inspect wallet details and related transactions.</p>
      </div>
    </header>

    <div class="search-row">
      <input v-model="address" placeholder="Wallet address" class="search-input" @keyup.enter="searchAddress" />
      <button class="primary-btn" @click="searchAddress">Search</button>
    </div>

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="loading">Loading address...</p>

    <section v-if="addressInfo" class="panel">
      <h2>Address Info</h2>
      <table class="data-table">
        <tbody>
          <tr>
            <th>Address</th>
            <td class="truncate">{{ addressInfo.address ?? address }}</td>
          </tr>
          <tr>
            <th>Balance</th>
            <td>{{ addressInfo.balance ?? addressInfo.amount ?? '-' }}</td>
          </tr>
          <tr>
            <th>Tx Count</th>
            <td>{{ addressInfo.transactionsCount ?? transactions.length }}</td>
          </tr>
        </tbody>
      </table>

      <details class="raw-json">
        <summary>Raw JSON</summary>
        <pre class="json-box">{{ JSON.stringify(addressInfo, null, 2) }}</pre>
      </details>
    </section>

    <section class="panel">
      <h2>Address Transactions</h2>
      <p v-if="transactions.length === 0">No transactions to show.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>TxId</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in transactions" :key="String(tx.txId ?? tx.hash ?? tx.id ?? `${tx.from ?? ''}-${tx.to ?? ''}-${tx.amount ?? ''}`)">
            <td class="truncate">
              <RouterLink
                v-if="tx.txId || tx.hash"
                :to="`/tx/${String(tx.txId ?? tx.hash)}`"
                class="explorer-link"
              >
                {{ tx.txId ?? tx.hash }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="tx.from || tx.fromAddress"
                :to="`/address/${String(tx.from ?? tx.fromAddress)}`"
                class="explorer-link"
              >
                {{ tx.from ?? tx.fromAddress }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="tx.to || tx.toAddress"
                :to="`/address/${String(tx.to ?? tx.toAddress)}`"
                class="explorer-link"
              >
                {{ tx.to ?? tx.toAddress }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td>{{ tx.amount ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
