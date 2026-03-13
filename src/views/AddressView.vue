<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAddress, fetchAddressTxs, type GenericRecord } from '../services/explorerApi'
import { formatAddressDisplay } from '../utils/addressFormat'

const address = ref('')
const loading = ref(false)
const error = ref('')
const addressInfo = ref<GenericRecord | null>(null)
const transactions = ref<GenericRecord[]>([])
const route = useRoute()
const router = useRouter()
const encodeParam = (value: string) => encodeURIComponent(value)

const latestTenTransactions = computed(() => transactions.value.slice(0, 10))

const walletValue = computed(() => {
  const info = addressInfo.value ?? {}
  return info.balance ?? info.amount ?? info.netAmount ?? '-'
})

const firstAddress = (side: unknown): string => {
  if (!Array.isArray(side) || side.length === 0) return ''
  const first = side[0]
  if (!first || typeof first !== 'object') return ''
  return String((first as GenericRecord).address ?? '')
}

const txFrom = (tx: GenericRecord): string => {
  const fromAddress = tx.fromAddress
  if (typeof fromAddress === 'string' && fromAddress.trim()) return fromAddress.trim()
  const fromFirst = firstAddress(tx.from)
  if (fromFirst) return fromFirst
  if (typeof tx.from === 'string') return tx.from.trim()
  return ''
}

const txTo = (tx: GenericRecord): string => {
  const toAddress = tx.toAddress
  if (typeof toAddress === 'string' && toAddress.trim()) return toAddress.trim()
  const toFirst = firstAddress(tx.to)
  if (toFirst) return toFirst
  if (typeof tx.to === 'string') return tx.to.trim()
  return ''
}

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
    transactions.value = [...txs].sort((a, b) => {
      const heightA = Number(a.blockHeight ?? 0)
      const heightB = Number(b.blockHeight ?? 0)
      if (heightA !== heightB) return heightB - heightA

      const tsA = Number(a.timestamp ?? a.timeStamp ?? 0)
      const tsB = Number(b.timestamp ?? b.timeStamp ?? 0)
      return tsB - tsA
    })
    const routeAddress = formatAddressDisplay(trimmed)
    address.value = routeAddress
    if (updateRoute) {
      await router.push(`/address/${encodeURIComponent(routeAddress)}`)
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
            <td class="truncate">{{ formatAddressDisplay(addressInfo.address ?? address) }}</td>
          </tr>
          <tr>
            <th>Wallet Value</th>
            <td>{{ walletValue }}</td>
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
      <h2>Address Transactions (Latest 10)</h2>
      <p v-if="transactions.length === 0">No transactions to show.</p>
      <table v-if="transactions.length > 0" class="data-table">
        <thead>
          <tr>
            <th>TxId</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in latestTenTransactions" :key="String(tx.txId ?? tx.hash ?? tx.id ?? `${tx.from ?? ''}-${tx.to ?? ''}-${tx.amount ?? ''}`)">
            <td class="truncate">
              <RouterLink
                v-if="tx.txId || tx.hash"
                :to="`/tx/${encodeParam(String(tx.txId ?? tx.hash))}`"
                class="explorer-link"
              >
                {{ tx.txId ?? tx.hash }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="txFrom(tx)"
                :to="`/address/${encodeParam(formatAddressDisplay(txFrom(tx)))}`"
                class="explorer-link"
              >
                {{ formatAddressDisplay(txFrom(tx)) }}
              </RouterLink>
              <span v-else>-</span>
            </td>
            <td class="truncate">
              <RouterLink
                v-if="txTo(tx)"
                :to="`/address/${encodeParam(formatAddressDisplay(txTo(tx)))}`"
                class="explorer-link"
              >
                {{ formatAddressDisplay(txTo(tx)) }}
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
