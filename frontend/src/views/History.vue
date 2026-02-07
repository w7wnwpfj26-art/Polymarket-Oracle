<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

interface ExecutionPlan {
  id: string;
  finalDecision: string;
  unanimousApproval: boolean;
  expectedReturn: number;
  maxLoss: number;
  createdAt: string;
  opportunity: {
    type: string;
    markets: {
      polymarket: {
        question: string;
      };
    };
    expectedProfitPercent: number;
  };
}

const api = useApi();
const history = ref<ExecutionPlan[]>([]);
const isLoading = ref(true);

const formatPercent = (num: number) => num.toFixed(2) + '%';
const formatDate = (date: string) => new Date(date).toLocaleString();

onMounted(async () => {
  try {
    const result = await api.get<ExecutionPlan[]>('/api/arbitrage/history');
    history.value = result || [];
  } catch (e) {
    console.error('Failed to fetch history:', e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">执行历史</h1>
      <div class="text-sm text-white/40">
        共 {{ history.length }} 条记录
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-20 text-white/40">
      <div class="w-8 h-8 border-2 border-cyber-neon border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>

    <div v-else-if="history.length === 0" class="card text-center py-20">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-4 text-white/20">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <h2 class="text-xl font-bold text-white/40">暂无执行历史</h2>
      <p class="text-white/30 mt-2">开始扫描和分析套利机会后，历史记录将在这里显示</p>
    </div>

    <div v-else class="card overflow-hidden">
      <table class="table-cyber">
        <thead>
          <tr>
            <th>时间</th>
            <th>市场</th>
            <th>类型</th>
            <th>决策</th>
            <th>预期收益</th>
            <th>一致通过</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in history" :key="item.id">
            <td class="text-sm text-white/60">{{ formatDate(item.createdAt) }}</td>
            <td>
              <div class="max-w-xs truncate">{{ item.opportunity.markets.polymarket.question }}</div>
            </td>
            <td>
              <span class="text-xs px-2 py-1 rounded bg-white/10">
                {{ item.opportunity.type }}
              </span>
            </td>
            <td>
              <span :class="[
                'text-xs px-2 py-1 rounded font-medium',
                item.finalDecision === 'EXECUTE' ? 'bg-cyber-neon/20 text-cyber-neon' :
                item.finalDecision === 'HOLD' ? 'bg-cyber-yellow/20 text-cyber-yellow' :
                'bg-cyber-red/20 text-cyber-red'
              ]">
                {{ item.finalDecision }}
              </span>
            </td>
            <td class="mono text-cyber-neon">
              +{{ formatPercent(item.opportunity.expectedProfitPercent) }}
            </td>
            <td>
              <span v-if="item.unanimousApproval" class="text-cyber-neon">✓</span>
              <span v-else class="text-white/40">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
