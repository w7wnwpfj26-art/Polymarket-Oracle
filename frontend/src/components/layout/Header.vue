<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStore } from '@/stores/system';
import { storeToRefs } from 'pinia';

const systemStore = useSystemStore();
const { dashboardStats, isConnected, status } = storeToRefs(systemStore);

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const handleEmergencyHalt = async () => {
  if (confirm('确定要紧急停止系统吗？所有操作将被中止。')) {
    await systemStore.emergencyHalt();
  }
};

const handleScan = async () => {
  // Trigger scan via API
  try {
    await fetch('/api/arbitrage/scan', { method: 'POST' });
    systemStore.fetchDashboard();
  } catch (e) {
    console.error('Scan failed:', e);
  }
};
</script>

<template>
  <header class="h-16 bg-cyber-dark/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-10">
    <!-- Status -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span 
          :class="[
            'w-2.5 h-2.5 rounded-full',
            isConnected ? 'status-online animate-pulse' : 'status-error'
          ]"
        ></span>
        <span class="text-sm text-white/60">
          {{ isConnected ? '系统运行中' : '系统离线' }}
        </span>
      </div>
      
      <div class="h-4 w-px bg-white/10"></div>
      
      <div class="text-sm">
        <span class="text-white/40">模式：</span>
        <span :class="status?.mode === 'LIVE' ? 'text-cyber-red' : 'text-cyber-neon'">
          {{ status?.mode === 'LIVE' ? '实盘' : '模拟' }}
        </span>
      </div>
    </div>

    <!-- Stats -->
    <div class="flex items-center gap-8">
      <div class="text-right">
        <div class="text-xs text-white/40 uppercase tracking-wider">总资本</div>
        <div class="text-lg font-bold mono">${{ formatNumber(dashboardStats.capital) }}</div>
      </div>
      
      <div class="text-right">
        <div class="text-xs text-white/40 uppercase tracking-wider">今日收益</div>
        <div class="text-lg font-bold mono text-cyber-neon">
          +${{ formatNumber(dashboardStats.profitToday) }}
        </div>
      </div>
      
      <div class="text-right">
        <div class="text-xs text-white/40 uppercase tracking-wider">代理在线</div>
        <div class="text-lg font-bold">{{ dashboardStats.agentsOnline }} / 6</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button @click="handleScan" class="btn-primary flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        扫描市场
      </button>
      
      <button @click="handleEmergencyHalt" class="btn-danger flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        紧急停止
      </button>
    </div>
  </header>
</template>
