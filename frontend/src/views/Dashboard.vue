<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '@/stores/system';
import { storeToRefs } from 'pinia';
import { useApi } from '@/composables/useApi';

const systemStore = useSystemStore();
const { dashboardStats, status } = storeToRefs(systemStore);
const api = useApi();

const opportunities = ref<any[]>([]);

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatPercent = (num: number) => {
  return num.toFixed(2) + '%';
};

onMounted(async () => {
  try {
    const opps = await api.get<any[]>('/api/arbitrage/opportunities');
    opportunities.value = opps || [];
  } catch (e) {
    console.error('Failed to fetch opportunities:', e);
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Capital -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-white/40 uppercase tracking-wider">总资本</p>
            <p class="text-2xl font-bold mono mt-1">${{ formatNumber(dashboardStats.capital) }}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-cyber-neon/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Today's Profit -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-white/40 uppercase tracking-wider">今日收益</p>
            <p class="text-2xl font-bold mono mt-1 text-cyber-neon">
              +${{ formatNumber(dashboardStats.profitToday) }}
            </p>
            <p class="text-xs text-cyber-neon mt-1">
              +{{ formatPercent(dashboardStats.profitPercent) }}
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-cyber-neon/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Markets Active -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-white/40 uppercase tracking-wider">监控市场</p>
            <p class="text-2xl font-bold mono mt-1">{{ dashboardStats.marketsActive }}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-cyber-blue/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Agents Online -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-white/40 uppercase tracking-wider">代理在线</p>
            <p class="text-2xl font-bold mono mt-1">{{ dashboardStats.agentsOnline }} / 6</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-cyber-purple/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bc13fe" stroke-width="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Opportunities -->
      <div class="lg:col-span-2 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold">套利机会</h2>
          <span class="text-xs px-2 py-1 rounded-full bg-cyber-neon/10 text-cyber-neon">
            {{ opportunities.length }} 个机会
          </span>
        </div>
        
        <div v-if="opportunities.length === 0" class="text-center py-12 text-white/40">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-4 opacity-50">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>暂无套利机会</p>
          <p class="text-sm mt-2">点击「扫描市场」开始搜寻</p>
        </div>
        
        <div v-else class="space-y-3">
          <div 
            v-for="opp in opportunities.slice(0, 5)" 
            :key="opp.id"
            class="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs px-2 py-0.5 rounded bg-cyber-neon/20 text-cyber-neon">
                  {{ opp.type }}
                </span>
                <h3 class="font-medium mt-2">{{ opp.markets.polymarket.question }}</h3>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-cyber-neon">+{{ formatPercent(opp.expectedProfitPercent) }}</p>
                <p class="text-xs text-white/40">${{ formatNumber(opp.expectedProfit) }} 预期收益</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Status -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4">代理状态</h2>
        
        <div class="space-y-3">
          <div 
            v-for="agent in status?.agents || []" 
            :key="agent.id"
            class="flex items-center justify-between p-3 bg-white/5 rounded-lg"
          >
            <div class="flex items-center gap-3">
              <span 
                :class="[
                  'w-2 h-2 rounded-full',
                  agent.status === 'ONLINE' ? 'status-online' : 
                  agent.status === 'ERROR' ? 'status-error' : 'status-offline'
                ]"
              ></span>
              <span>{{ agent.name }}</span>
            </div>
            <span class="text-xs text-white/40">
              {{ (agent.approvalRate * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Risk Monitor -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">风险监控</h2>
        <span :class="[
          'text-xs px-3 py-1 rounded-full font-medium',
          dashboardStats.riskLevel === 'LOW' ? 'bg-cyber-neon/20 text-cyber-neon' :
          dashboardStats.riskLevel === 'MEDIUM' ? 'bg-cyber-yellow/20 text-cyber-yellow' :
          'bg-cyber-red/20 text-cyber-red'
        ]">
          风险等级：{{ dashboardStats.riskLevel === 'LOW' ? '低' : dashboardStats.riskLevel === 'MEDIUM' ? '中' : '高' }}
        </span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 bg-white/5 rounded-lg text-center">
          <p class="text-xs text-white/40 uppercase">语义风险阈值</p>
          <p class="text-xl font-bold mt-1">30</p>
        </div>
        <div class="p-4 bg-white/5 rounded-lg text-center">
          <p class="text-xs text-white/40 uppercase">不可逆要求</p>
          <p class="text-xl font-bold mt-1">80%</p>
        </div>
        <div class="p-4 bg-white/5 rounded-lg text-center">
          <p class="text-xs text-white/40 uppercase">单笔上限</p>
          <p class="text-xl font-bold mt-1">$1,000</p>
        </div>
        <div class="p-4 bg-white/5 rounded-lg text-center">
          <p class="text-xs text-white/40 uppercase">总敞口上限</p>
          <p class="text-xl font-bold mt-1">$10,000</p>
        </div>
      </div>
    </div>
  </div>
</template>
