<script setup lang="ts">
import { ref } from 'vue'
import { fetchBlockByParam, fetchLatestBlocks, type GenericRecord } from '../services/explorerApi'

const loading = ref(false)
const error = ref('')
const query = ref('')
const latest = ref<GenericRecord[]>([])
const selected = ref<GenericRecord | null>(null)

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

const searchBlock = async () => {
  if (!query.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    selected.value = await fetchBlockByParam(query.value.trim())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Block not found.'
    selected.value = null
  } finally {
    loading.value = false
  }
}

void loadLatest()
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
      <pre class="json-box">{{ JSON.stringify(selected, null, 2) }}</pre>
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
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="block in latest" :key="String(block.hash ?? block.height)">
            <td>{{ block.height ?? '-' }}</td>
            <td class="truncate">{{ block.hash ?? '-' }}</td>
            <td>{{ block.timestamp ?? block.timeStamp ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
