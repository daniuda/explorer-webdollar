<script setup lang="ts">
import { ref } from 'vue'
import { fetchTransaction, type GenericRecord } from '../services/explorerApi'

const txId = ref('')
const loading = ref(false)
const error = ref('')
const transaction = ref<GenericRecord | null>(null)

const searchTx = async () => {
  if (!txId.value.trim()) return
  loading.value = true
  error.value = ''
  transaction.value = null

  try {
    transaction.value = await fetchTransaction(txId.value.trim())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Transaction not found.'
  } finally {
    loading.value = false
  }
}
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
      <pre class="json-box">{{ JSON.stringify(transaction, null, 2) }}</pre>
    </section>
  </section>
</template>
