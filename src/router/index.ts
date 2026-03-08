import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import BlocksView from '../views/BlocksView.vue'
import TransactionsView from '../views/TransactionsView.vue'
import AddressView from '../views/AddressView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/blocks', name: 'blocks', component: BlocksView },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/address', name: 'address', component: AddressView },
  ],
})

export default router
