import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
    },
    {
      path: '/markets',
      name: 'markets',
      component: () => import('@/views/Markets.vue'),
    },
    {
      path: '/arbitrage',
      name: 'arbitrage',
      component: () => import('@/views/Arbitrage.vue'),
    },
    {
      path: '/agents',
      name: 'agents',
      component: () => import('@/views/Agents.vue'),
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/views/Config.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/History.vue'),
    },
    {
      path: '/betting',
      name: 'betting',
      component: () => import('@/views/TradBetting.vue'),
    },
    {
      path: '/copy',
      name: 'copy',
      component: () => import('@/views/CopyTrading.vue'),
    },
    {
      path: '/sentiment',
      name: 'sentiment',
      component: () => import('@/views/Sentiment.vue'),
    },
  ],
});

export default router;
