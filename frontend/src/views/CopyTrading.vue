<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';

const api = useApi();

interface Trader {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  stats: {
    totalTrades: number;
    winRate: number;
    profitPercent: number;
    avgProfitPerTrade: number;
    maxDrawdown: number;
    sharpeRatio: number;
    lastMonthReturn: number;
    last30dPnL: number;
  };
  settings: {
    profitShare: number;
    minCopyAmount: number;
    maxCopyAmount: number;
  };
  followers: number;
}

interface CopyPosition {
  id: string;
  traderId: string;
  status: 'active' | 'paused' | 'closed';
  copyAmount: number;
  profitShareRate: number;
  totalProfit: number;
}

const traders = ref<Trader[]>([]);
const positions = ref<CopyPosition[]>([]);
const stats = ref<any>(null);
const isLoading = ref(false);
const showCopyModal = ref(false);
const selectedTrader = ref<Trader | null>(null);
const copyAmount = ref(1000);

const formatNumber = (num: number) => num?.toFixed(2) || '0.00';
const formatPercent = (num: number) => (num >= 0 ? '+' : '') + num?.toFixed(2) + '%';

// 获取交易员列表
const fetchTraders = async () => {
  try {
    const result = await api.get<Trader[]>('/api/copy/traders?sortBy=profitPercent&verified=true');
    traders.value = result || [];
  } catch (e) {
    console.error('Failed to fetch traders:', e);
  }
};

// 获取我的跟单仓位
const fetchPositions = async () => {
  try {
    const result = await api.get<CopyPosition[]>('/api/copy/positions');
    positions.value = result || [];
  } catch (e) {
    console.error('Failed to fetch positions:', e);
  }
};

// 获取统计
const fetchStats = async () => {
  try {
    const result = await api.get<any>('/api/copy/stats');
    stats.value = result;
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  }
};

// 开始跟单
const startCopying = async () => {
  if (!selectedTrader.value) return;
  
  try {
    await api.post('/api/copy/positions', {
      traderId: selectedTrader.value.id,
      amount: copyAmount.value,
    });
    showCopyModal.value = false;
    await Promise.all([fetchPositions(), fetchStats()]);
  } catch (e) {
    console.error('Failed to start copying:', e);
  }
};

// 打开跟单弹窗
const openCopyModal = (trader: Trader) => {
  selectedTrader.value = trader;
  copyAmount.value = trader.settings.minCopyAmount;
  showCopyModal.value = true;
};

// 停止跟单
const stopCopying = async (positionId: string) => {
  if (!confirm('确定要停止跟单吗？')) return;
  
  try {
    await api.delete(`/api/copy/positions/${positionId}`);
    await Promise.all([fetchPositions(), fetchStats()]);
  } catch (e) {
    console.error('Failed to stop copying:', e);
  }
};

// 获取交易员信息
const getTraderById = (id: string) => traders.value.find(t => t.id === id);

onMounted(async () => {
  isLoading.value = true;
  await Promise.all([fetchTraders(), fetchPositions(), fetchStats()]);
  isLoading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- 页头 -->
    <div>
      <h1 class="text-2xl font-bold">跟单交易</h1>
      <p class="text-white/40 text-sm mt-1">跟随顶级交易员，分享利润</p>
    </div>

    <!-- 统计卡片 -->
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card p-4">
        <p class="text-xs text-white/40 uppercase">活跃跟单</p>
        <p class="text-2xl font-bold text-cyber-neon mt-1">{{ stats.activePositions }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-white/40 uppercase">总投资</p>
        <p class="text-2xl font-bold mt-1">${{ formatNumber(stats.totalInvested) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-white/40 uppercase">总收益</p>
        <p :class="['text-2xl font-bold mt-1', stats.totalProfit >= 0 ? 'text-cyber-neon' : 'text-red-400']">
          {{ stats.totalProfit >= 0 ? '+' : '' }}${{ formatNumber(stats.totalProfit) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-white/40 uppercase">净收益 (扣除分成)</p>
        <p :class="['text-2xl font-bold mt-1', stats.netProfit >= 0 ? 'text-cyber-neon' : 'text-red-400']">
          {{ stats.netProfit >= 0 ? '+' : '' }}${{ formatNumber(stats.netProfit) }}
        </p>
      </div>
    </div>

    <!-- 我的跟单 -->
    <div v-if="positions.length > 0" class="card">
      <h2 class="text-lg font-bold mb-4">我的跟单</h2>
      <div class="space-y-3">
        <div 
          v-for="pos in positions" 
          :key="pos.id"
          class="flex items-center justify-between p-4 bg-white/5 rounded-lg"
        >
          <div class="flex items-center gap-4">
            <img 
              :src="getTraderById(pos.traderId)?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${pos.traderId}`"
              class="w-12 h-12 rounded-full bg-white/10"
            />
            <div>
              <p class="font-medium">{{ getTraderById(pos.traderId)?.name || pos.traderId }}</p>
              <div class="flex items-center gap-3 mt-1 text-sm text-white/50">
                <span>投入: ${{ formatNumber(pos.copyAmount) }}</span>
                <span>分成: {{ pos.profitShareRate }}%</span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p :class="['font-bold', pos.totalProfit >= 0 ? 'text-cyber-neon' : 'text-red-400']">
                {{ pos.totalProfit >= 0 ? '+' : '' }}${{ formatNumber(pos.totalProfit) }}
              </p>
              <p :class="['text-xs', pos.status === 'active' ? 'text-green-400' : 'text-yellow-400']">
                {{ pos.status === 'active' ? '活跃' : pos.status === 'paused' ? '已暂停' : '已关闭' }}
              </p>
            </div>
            <button 
              @click="stopCopying(pos.id)"
              class="px-3 py-1.5 text-sm text-red-400 border border-red-400/30 rounded hover:bg-red-400/10"
            >
              停止
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 交易员排行榜 -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🏆 交易员排行榜</h2>
      
      <div v-if="isLoading" class="text-center py-12 text-white/40">
        <div class="w-8 h-8 border-2 border-cyber-neon border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4">加载中...</p>
      </div>
      
      <div v-else class="space-y-4">
        <div 
          v-for="(trader, index) in traders" 
          :key="trader.id"
          class="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-cyber-neon/30 transition"
        >
          <div class="flex items-start gap-4">
            <!-- 排名 -->
            <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                 :class="index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                         index === 1 ? 'bg-gray-400/20 text-gray-300' :
                         index === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white/40'">
              {{ index + 1 }}
            </div>
            
            <!-- 头像和信息 -->
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <img 
                  :src="trader.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${trader.id}`"
                  class="w-12 h-12 rounded-full bg-white/10"
                />
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold">{{ trader.name }}</span>
                    <span v-if="trader.verified" class="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                      ✓ 已认证
                    </span>
                  </div>
                  <p class="text-sm text-white/50 mt-0.5">{{ trader.bio }}</p>
                </div>
              </div>
              
              <!-- 统计数据 -->
              <div class="grid grid-cols-4 gap-4 mt-4">
                <div>
                  <p class="text-xs text-white/40">总收益</p>
                  <p :class="['font-bold', trader.stats.profitPercent >= 0 ? 'text-cyber-neon' : 'text-red-400']">
                    {{ formatPercent(trader.stats.profitPercent) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-white/40">胜率</p>
                  <p class="font-bold">{{ trader.stats.winRate.toFixed(1) }}%</p>
                </div>
                <div>
                  <p class="text-xs text-white/40">夏普比率</p>
                  <p class="font-bold">{{ trader.stats.sharpeRatio.toFixed(2) }}</p>
                </div>
                <div>
                  <p class="text-xs text-white/40">跟随者</p>
                  <p class="font-bold">{{ trader.followers }}</p>
                </div>
              </div>
              
              <!-- 更多信息 -->
              <div class="flex items-center gap-4 mt-3 text-sm text-white/40">
                <span>交易次数: {{ trader.stats.totalTrades }}</span>
                <span>最大回撤: {{ trader.stats.maxDrawdown.toFixed(1) }}%</span>
                <span>分成比例: {{ trader.settings.profitShare }}%</span>
              </div>
            </div>
            
            <!-- 跟单按钮 -->
            <button 
              @click="openCopyModal(trader)"
              class="px-5 py-2.5 bg-cyber-neon text-black font-bold rounded-lg hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] transition"
            >
              跟单
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 跟单弹窗 -->
    <div v-if="showCopyModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div class="bg-[#161b22] border border-white/10 rounded-xl p-6 w-full max-w-md">
        <h3 class="text-xl font-bold mb-4">跟单 {{ selectedTrader?.name }}</h3>
        
        <div class="space-y-4">
          <!-- 交易员信息 -->
          <div class="p-4 bg-white/5 rounded-lg">
            <div class="flex items-center gap-3">
              <img 
                :src="selectedTrader?.avatar"
                class="w-10 h-10 rounded-full bg-white/10"
              />
              <div>
                <p class="font-medium">{{ selectedTrader?.name }}</p>
                <p class="text-sm text-cyber-neon">{{ formatPercent(selectedTrader?.stats.profitPercent || 0) }} 总收益</p>
              </div>
            </div>
          </div>
          
          <!-- 跟单金额 -->
          <div>
            <label class="block text-sm text-white/60 mb-2">跟单金额 (USDC)</label>
            <input 
              v-model.number="copyAmount"
              type="number"
              :min="selectedTrader?.settings.minCopyAmount"
              :max="selectedTrader?.settings.maxCopyAmount"
              class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-lg font-mono"
            />
            <p class="text-xs text-white/40 mt-1">
              范围: ${{ selectedTrader?.settings.minCopyAmount }} - ${{ selectedTrader?.settings.maxCopyAmount }}
            </p>
          </div>
          
          <!-- 分成说明 -->
          <div class="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p class="text-sm text-yellow-400">
              💡 利润分成: {{ selectedTrader?.settings.profitShare }}%
            </p>
            <p class="text-xs text-white/50 mt-1">
              当产生盈利时，{{ selectedTrader?.settings.profitShare }}% 归交易员，{{ 100 - (selectedTrader?.settings.profitShare || 0) }}% 归您
            </p>
          </div>
          
          <!-- 按钮 -->
          <div class="flex gap-3 mt-6">
            <button 
              @click="showCopyModal = false"
              class="flex-1 py-3 border border-white/20 rounded-lg hover:bg-white/5"
            >
              取消
            </button>
            <button 
              @click="startCopying"
              class="flex-1 py-3 bg-cyber-neon text-black font-bold rounded-lg hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]"
            >
              确认跟单
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
