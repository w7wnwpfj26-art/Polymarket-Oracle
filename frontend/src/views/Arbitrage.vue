<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useI18n } from '@/composables/useI18n';

const api = useApi();
const { language, setLanguage, languageOptions, initLanguage } = useI18n();

initLanguage();

// 状态
const opportunities = ref<any[]>([]);
const isLoading = ref(false);
const isScanning = ref(false);
const isAnalyzing = ref<string | null>(null);

// 自动刷新
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const formatNumber = (num: number) => num?.toFixed(2) || '0.00';
const formatPercent = (num: number) => (num?.toFixed(2) || '0.00') + '%';

// 扫描套利机会
const scan = async () => {
  isScanning.value = true;
  try {
    const result = await api.post<{ found: number; opportunities: any[] }>('/api/arbitrage/scan');
    opportunities.value = result.opportunities || [];
  } catch (e) {
    console.error('Scan failed:', e);
  } finally {
    isScanning.value = false;
  }
};

// AI 分析
const analyzeWithAI = async (opp: any) => {
  isAnalyzing.value = opp.id;
  try {
    const result = await api.post<any>(`/api/arbitrage/analyze/${opp.id}`);
    opp.analysis = result;
  } catch (e) {
    console.error('Analysis failed:', e);
  } finally {
    isAnalyzing.value = null;
  }
};

// 获取套利类型标签
const getTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    'DUTCH_BOOK': '荷兰盘套利',
    'CROSS_PLATFORM': '跨平台套利',
    'HEDGE_ARB': '对冲套利',
  };
  return types[type] || type;
};

// 获取类型颜色
const getTypeColor = (type: string) => {
  switch (type) {
    case 'DUTCH_BOOK': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'CROSS_PLATFORM': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'HEDGE_ARB': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default: return 'bg-white/10 text-white/60';
  }
};

onMounted(async () => {
  isLoading.value = true;
  try {
    const result = await api.get<any[]>('/api/arbitrage/opportunities');
    opportunities.value = result || [];
  } catch (e) {
    console.error('Failed to fetch:', e);
  } finally {
    isLoading.value = false;
  }
  
  // 每 30 秒自动刷新
  refreshInterval = setInterval(scan, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- 页头 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">套利机会</h1>
        <p class="text-white/40 text-sm mt-1">Polymarket vs 传统平台 · 实时检测</p>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- 语言选择 -->
        <select 
          :value="language"
          @change="setLanguage(($event.target as HTMLSelectElement).value as any)"
          class="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm"
        >
          <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        
        <!-- 扫描按钮 -->
        <button 
          @click="scan" 
          :disabled="isScanning"
          class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-black transition-all"
          :class="isScanning ? 'bg-white/20 text-white/40' : 'bg-[#00ff88] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]'"
        >
          <svg v-if="isScanning" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {{ isScanning ? '扫描中...' : '扫描市场' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="text-center py-24 text-white/40">
      <div class="w-12 h-12 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="mt-4 text-sm">正在加载套利机会...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="opportunities.length === 0" class="text-center py-24">
      <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-white/20">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-white/50">暂无套利机会</h2>
      <p class="text-white/30 mt-2 text-sm">点击上方「扫描市场」开始检测</p>
    </div>

    <!-- 套利机会列表 -->
    <div v-else class="space-y-4">
      <div 
        v-for="opp in opportunities" 
        :key="opp.id"
        class="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden hover:border-[#00ff88]/30 transition-all"
      >
        <!-- 标签行 -->
        <div class="px-5 pt-5 pb-3 flex items-center gap-3">
          <span :class="['text-xs px-3 py-1 rounded-full font-medium border', getTypeColor(opp.type)]">
            {{ getTypeLabel(opp.type) }}
          </span>
          <span class="text-xs text-white/30 font-mono">{{ opp.id }}</span>
        </div>

        <!-- 市场问题 -->
        <div class="px-5 pb-4">
          <h3 class="text-lg font-medium leading-relaxed">
            {{ opp.markets?.polymarket?.question || '未知市场' }}
          </h3>
        </div>

        <!-- 双平台对比 -->
        <div class="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Polymarket -->
          <div class="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <span class="text-sm font-bold text-purple-400">P</span>
              </div>
              <div>
                <span class="text-sm font-semibold text-purple-400">Polymarket</span>
                <span class="text-xs text-white/30 ml-2">预测市场</span>
              </div>
            </div>
            
            <div class="space-y-3">
              <div v-for="outcome in opp.markets?.polymarket?.outcomes || []" :key="outcome.name" 
                   class="flex items-center justify-between p-3 rounded-lg bg-black/30">
                <span class="text-sm text-white/70">{{ outcome.name || outcome.side }}</span>
                <div class="text-right">
                  <span class="text-lg font-bold text-[#00ff88]">{{ (outcome.price * 100).toFixed(1) }}¢</span>
                  <p class="text-xs text-white/40">概率 {{ (outcome.price * 100).toFixed(1) }}%</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 传统平台 -->
          <div class="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <span class="text-sm font-bold text-blue-400">T</span>
              </div>
              <div>
                <span class="text-sm font-semibold text-blue-400">
                  {{ opp.markets?.traditional?.bookmaker || '传统平台' }}
                </span>
                <span class="text-xs text-white/30 ml-2">博彩赔率</span>
              </div>
            </div>
            
            <div class="space-y-3">
              <template v-if="opp.markets?.traditional?.outcomes">
                <div v-for="outcome in opp.markets.traditional.outcomes" :key="outcome.name" 
                     class="flex items-center justify-between p-3 rounded-lg bg-black/30">
                  <span class="text-sm text-white/70">{{ outcome.name }}</span>
                  <div class="text-right">
                    <span class="text-lg font-bold text-blue-400">{{ outcome.odds?.toFixed(2) }}</span>
                    <p class="text-xs text-white/40">概率 {{ (outcome.impliedProbability * 100).toFixed(1) }}%</p>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="p-4 text-center text-white/30 text-sm">
                  <p>荷兰盘套利</p>
                  <p class="text-xs mt-1">仅使用 Polymarket 内部价格</p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 收益统计 -->
        <div class="grid grid-cols-3 border-t border-white/5 bg-black/20">
          <div class="p-5 text-center border-r border-white/5">
            <p class="text-xs text-white/40 uppercase tracking-wide mb-2">预期收益</p>
            <p class="text-2xl font-bold text-[#00ff88]">+${{ formatNumber(opp.expectedProfit) }}</p>
          </div>
          <div class="p-5 text-center border-r border-white/5">
            <p class="text-xs text-white/40 uppercase tracking-wide mb-2">收益率</p>
            <p class="text-2xl font-bold text-[#00ff88]">+{{ formatPercent(opp.expectedProfitPercent) }}</p>
          </div>
          <div class="p-5 text-center">
            <p class="text-xs text-white/40 uppercase tracking-wide mb-2">最大亏损</p>
            <p :class="['text-2xl font-bold', opp.worstCaseLoss === 0 ? 'text-[#00ff88]' : 'text-red-400']">
              ${{ formatNumber(opp.worstCaseLoss) }}
            </p>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="p-5 border-t border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-4 text-sm text-white/40">
            <span>置信度: <span class="text-white/70">{{ opp.confidence || 80 }}%</span></span>
            <span>有效期: <span class="text-white/70">{{ new Date(opp.validUntil).toLocaleTimeString() }}</span></span>
          </div>
          
          <button 
            @click="analyzeWithAI(opp)"
            :disabled="isAnalyzing === opp.id"
            class="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#00ff88]/50 text-[#00ff88] font-medium hover:bg-[#00ff88]/10 transition disabled:opacity-50"
          >
            <svg v-if="isAnalyzing === opp.id" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {{ isAnalyzing === opp.id ? '分析中...' : 'AI 分析' }}
          </button>
        </div>

        <!-- AI 分析结果 -->
        <div v-if="opp.analysis" class="p-5 border-t border-white/5 bg-white/[0.02]">
          <div class="flex items-center justify-between mb-4">
            <span class="font-semibold">AI 分析结果</span>
            <span :class="[
              'text-sm px-4 py-1.5 rounded-full font-medium',
              opp.analysis.finalDecision === 'EXECUTE' ? 'bg-[#00ff88]/20 text-[#00ff88]' :
              opp.analysis.finalDecision === 'HOLD' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            ]">
              {{ opp.analysis.finalDecision === 'EXECUTE' ? '✓ 建议执行' :
                 opp.analysis.finalDecision === 'HOLD' ? '⏸ 暂不交易' : '✕ 拒绝交易' }}
            </span>
          </div>
          
          <!-- 代理决策 -->
          <div v-if="opp.analysis.agentResponses?.length" class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            <div 
              v-for="agent in opp.analysis.agentResponses.slice(0, 6)" 
              :key="agent.agentId"
              class="p-3 bg-white/5 rounded-lg"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-white/50 truncate">{{ agent.agentName }}</span>
                <span :class="[
                  'text-sm',
                  agent.decision === 'APPROVE' ? 'text-green-400' :
                  agent.decision === 'REJECT' ? 'text-red-400' : 'text-yellow-400'
                ]">
                  {{ agent.decision === 'APPROVE' ? '✓' : agent.decision === 'REJECT' ? '✕' : '—' }}
                </span>
              </div>
              <p class="text-xs text-white/30">置信度: {{ agent.confidence }}%</p>
            </div>
          </div>

          <!-- 执行按钮 -->
          <button 
            v-if="opp.analysis.finalDecision === 'EXECUTE'"
            class="w-full py-3 bg-[#00ff88] text-black font-bold rounded-lg hover:shadow-[0_0_30px_rgba(0,255,136,0.4)] transition flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            立即执行套利
          </button>
        </div>
      </div>
    </div>

    <!-- 底部提示 -->
    <div v-if="opportunities.length > 0" class="text-center text-white/30 text-sm py-4">
      自动刷新已启用 (30s) · 最后更新: {{ new Date().toLocaleTimeString() }}
    </div>
  </div>
</template>
