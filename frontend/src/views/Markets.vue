<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

interface Market {
  id: string;
  question: string;
  description: string;
  outcomes: { name: string; price: number; side: string }[];
  volume24h: number;
  liquidity: number;
  source: string;
}

const api = useApi();
const markets = ref<Market[]>([]);
const isLoading = ref(true);

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
};

const formatPercent = (num: number) => (num * 100).toFixed(1) + '%';

onMounted(async () => {
  try {
    const response = await api.get<Market[]>('/api/markets');
    markets.value = response || [];
  } catch (e) {
    console.error('Failed to fetch markets:', e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">市场监控</h1>
      <div class="flex items-center gap-3">
        <input 
          type="text" 
          placeholder="搜索市场..." 
          class="w-64"
        />
        <select class="w-40">
          <option value="">所有来源</option>
          <option value="polymarket">Polymarket</option>
          <option value="odds_api">传统博彩</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-20 text-white/40">
      <div class="w-8 h-8 border-2 border-cyber-neon border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="mt-4">加载市场数据...</p>
    </div>

    <div v-else-if="markets.length === 0" class="text-center py-20 text-white/40">
      <p>暂无市场数据</p>
    </div>

    <div v-else class="card overflow-hidden">
      <table class="table-cyber">
        <thead>
          <tr>
            <th>市场</th>
            <th>YES 价格</th>
            <th>NO 价格</th>
            <th>24h 交易量</th>
            <th>流动性</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="market in markets" :key="market.id" class="cursor-pointer">
            <td>
              <div class="max-w-md">
                <p class="font-medium truncate">{{ market.question }}</p>
                <p class="text-xs text-white/40 truncate mt-1">{{ market.description }}</p>
              </div>
            </td>
            <td class="mono text-cyber-neon">
              {{ formatPercent(market.outcomes[0]?.price || 0) }}
            </td>
            <td class="mono text-cyber-red">
              {{ formatPercent(market.outcomes[1]?.price || 0) }}
            </td>
            <td class="mono">${{ formatNumber(market.volume24h) }}</td>
            <td class="mono">${{ formatNumber(market.liquidity) }}</td>
            <td>
              <span class="text-xs px-2 py-1 rounded bg-white/10">
                {{ market.source }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
