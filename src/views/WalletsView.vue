<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchTopWallets, type WalletEntry } from '../services/walletsApi'
import { formatAddressDisplay } from '../utils/addressFormat'

const loading = ref(false)
const error = ref('')
const wallets = ref<WalletEntry[]>([])
const selectedTop = ref(50)
const searchTerm = ref('')

const encodeParam = (value: string) => encodeURIComponent(value)
const TOP_OPTIONS = [10, 25, 50, 100]

const filteredWallets = computed(() => {
  const needle = searchTerm.value.trim().toLowerCase()
  if (!needle) return wallets.value

  return wallets.value.filter((wallet) => {
    const raw = wallet.address.toLowerCase()
    const display = formatAddressDisplay(wallet.address).toLowerCase()
    return raw.includes(needle) || display.includes(needle)
  })
})

const totalFilteredBalance = computed(() => {
  return filteredWallets.value.reduce((sum, wallet) => sum + wallet.balance, 0)
})

const topWallets = computed(() => filteredWallets.value)

const walletShare = (balance: number): string => {
  const total = totalFilteredBalance.value
  if (total <= 0) return '0.00%'
  const pct = (balance / total) * 100
  return `${pct.toFixed(2)}%`
}

const formatWalletBalance = (balance: number): string => {
  return `${balance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} WEBD`
}

const loadWallets = async () => {
  loading.value = true
  error.value = ''
  try {
    wallets.value = await fetchTopWallets(selectedTop.value)
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

watch(selectedTop, () => {
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

    <div class="search-row">
      <input
        v-model="searchTerm"
        class="search-input"
        placeholder="Cauta dupa adresa"
      />
      <select v-model.number="selectedTop" class="search-input" style="max-width: 140px">
        <option v-for="option in TOP_OPTIONS" :key="option" :value="option">Top {{ option }}</option>
      </select>
    </div>

    <section class="panel">
      <h2>Top Wallets</h2>
      <p v-if="!loading && topWallets.length === 0">Nu exista date disponibile.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Address</th>
            <th>Balance</th>
            <th>% din total</th>
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
            <td>{{ formatWalletBalance(wallet.balance) }}</td>
            <td>{{ walletShare(wallet.balance) }}</td>
            <td>{{ wallet.source }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
