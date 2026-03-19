import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import BlocksView from '../views/BlocksView.vue'
import TransactionsView from '../views/TransactionsView.vue'
import AddressView from '../views/AddressView.vue'
import PoolsView from '../views/PoolsView.vue'
import NetworkView from '../views/NetworkView.vue'
import WalletsView from '../views/WalletsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/blocks', name: 'blocks', component: BlocksView },
    { path: '/block/:param', name: 'block-detail', component: BlocksView },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/tx/:txId', name: 'tx-detail', component: TransactionsView },
    { path: '/address', name: 'address', component: AddressView },
    { path: '/address/:address', name: 'address-detail', component: AddressView },
    { path: '/pools', name: 'pools', component: PoolsView },
    { path: '/wallets', name: 'wallets', component: WalletsView },
    { path: '/network', name: 'network', component: NetworkView },
  ],
})

export default router
