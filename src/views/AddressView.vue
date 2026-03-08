<script setup lang="ts">
import { ref } from 'vue'
import { fetchAddress, fetchAddressTxs, type GenericRecord } from '../services/explorerApi'

const address = ref('')
const loading = ref(false)
const error = ref('')
const addressInfo = ref<GenericRecord | null>(null)
const transactions = ref<GenericRecord[]>([])

const searchAddress = async () => {
  if (!address.value.trim()) return

  loading.value = true
  error.value = ''
  addressInfo.value = null
  transactions.value = []

  try {
    const [info, txs] = await Promise.all([
      fetchAddress(address.value.trim()),
      fetchAddressTxs(address.value.trim()),
    ])
    addressInfo.value = info
    transactions.value = txs
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Address not found.'
  } finally {
    loading.value = false
  }
}
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
      <pre class="json-box">{{ JSON.stringify(addressInfo, null, 2) }}</pre>
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
          <tr v-for="tx in transactions" :key="String(tx.txId ?? tx.hash ?? Math.random())">
            <td class="truncate">{{ tx.txId ?? tx.hash ?? '-' }}</td>
            <td class="truncate">{{ tx.from ?? tx.fromAddress ?? '-' }}</td>
            <td class="truncate">{{ tx.to ?? tx.toAddress ?? '-' }}</td>
            <td>{{ tx.amount ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
