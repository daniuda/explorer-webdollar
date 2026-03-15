<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchNetworkOverview, type NetworkOverview } from '../services/networkApi'

const loading = ref(false)
const error = ref('')
const overview = ref<NetworkOverview | null>(null)

const confidenceLabel = computed(() => {
  if (!overview.value) return '-'
  const value = overview.value.confidence
  if (value === 'high') return 'High'
  if (value === 'medium') return 'Medium'
  return 'Low'
})

const estimatedLabel = computed(() => {
  const value = overview.value?.estimatedOnlineNodes
  return typeof value === 'number' ? value.toLocaleString('en-US') : '-'
})

const loadNetwork = async () => {
  loading.value = true
  error.value = ''
  try {
    overview.value = await fetchNetworkOverview()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Cannot load network data.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadNetwork()
})
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>Network</h1>
        <p>Observed peers and estimated online nodes.</p>
      </div>
      <button class="ghost-btn" @click="loadNetwork">Refresh</button>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <div class="metrics-grid">
      <article class="metric-card">
        <p class="metric-label">Observed Peers</p>
        <p class="metric-value">{{ overview?.observedPeers ?? '-' }}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Estimated Online Nodes</p>
        <p class="metric-value">{{ estimatedLabel }}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Source Endpoint</p>
        <p class="metric-value">{{ overview?.sourcePath ?? '-' }}</p>
      </article>
      <article class="metric-card">
        <p class="metric-label">Confidence</p>
        <p class="metric-value">{{ confidenceLabel }}</p>
      </article>
    </div>

    <section class="panel">
      <h2>Notes</h2>
      <p>{{ overview?.note ?? 'Loading...' }}</p>
    </section>

    <section class="panel">
      <h2>Endpoint Probes</h2>
      <p v-if="loading">Checking endpoints...</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Status</th>
            <th>HTTP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="probe in overview?.probes ?? []" :key="probe.path">
            <td><code>{{ probe.path }}</code></td>
            <td>{{ probe.ok ? 'OK' : 'Unavailable' }}</td>
            <td>{{ probe.statusCode ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Observed Peers</h2>
      <p v-if="loading">Loading peers...</p>
      <p v-else-if="(overview?.peers.length ?? 0) === 0">No peers received from API.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Address</th>
            <th>Port</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="peer in overview?.peers ?? []" :key="peer.key">
            <td class="truncate">{{ peer.address }}</td>
            <td>{{ peer.port }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>