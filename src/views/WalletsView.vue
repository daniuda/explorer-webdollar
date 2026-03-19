<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchTopWallets, type WalletEntry } from '../services/walletsApi'
import { formatAddressDisplay } from '../utils/addressFormat'
import { formatWebdAmount } from '../utils/webdAmount'

const loading = ref(false)
const error = ref('')
const wallets = ref<WalletEntry[]>([])

const encodeParam = (value: string) => encodeURIComponent(value)

const topWallets = computed(() => wallets.value.slice(0, 100))

const loadWallets = async () => {
  loading.value = true
  error.value = ''
  try {
    wallets.value = await fetchTopWallets(100)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Cannot load wallets list.'
    wallets.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadWallets()
})
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Wallets</h1>
        <p>Top adrese dupa numarul de WEBD (descrescator).</p>
      </div>
      <button class="ghost-btn" @click="loadWallets">Refresh</button>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="loading">Loading wallets...</p>

    <section class="panel">
      <h2>Top Wallets</h2>
      <p v-if="!loading && topWallets.length === 0">Nu exista date disponibile.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Address</th>
            <th>Balance</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(wallet, index) in topWallets" :key="`${wallet.address}-${wallet.balance}-${index}`">
            <td>{{ index + 1 }}</td>
            <td class="truncate">
              <RouterLink
                :to="`/address/${encodeParam(formatAddressDisplay(wallet.address))}`"
                class="explorer-link"
              >
                {{ formatAddressDisplay(wallet.address) }}
              </RouterLink>
            </td>
            <td>{{ formatWebdAmount(wallet.balance, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) }}</td>
            <td>{{ wallet.source }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
