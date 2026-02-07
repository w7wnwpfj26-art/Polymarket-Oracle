<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

const api = useApi();

interface TrendingTopic {
  topic: string;
  volume: number;
  sentiment: number;
}

interface MarketSentiment {
  marketId: string;
  marketQuestion: string;
  sentiment: {
    score: number;
    magnitude: number;
    label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    summary: string;
    keywords: string[];
  };
  priceImpact: {
    predicted: 'UP' | 'DOWN' | 'STABLE';
    confidence: number;
  };
  alerts: string[];
}

const trending = ref<TrendingTopic[]>([]);
const marketSentiments = ref<MarketSentiment[]>([]);
const isLoading = ref(false);
const analyzeText = ref('');
const analysisResult = ref<any>(null);
const isAnalyzing = ref(false);

// 获取趋势话题
const fetchTrending = async () => {
  try {
    const result = await api.get<TrendingTopic[]>('/api/sentiment/trending');
    trending.value = result || [];
  } catch (e) {
    console.error('Failed to fetch trending:', e);
  }
};

// 分析市场情绪
const analyzeMarkets = async () => {
  isLoading.value = true;
  try {
    // 获取市场列表然后分析
    const markets = await api.get<any[]>('/api/markets');
    if (markets && markets.length > 0) {
      const result = await api.post<MarketSentiment[]>('/api/sentiment/markets', {
        markets: markets.slice(0, 5).map(m => ({
          id: m.id || m.condition_id,
          question: m.question,
        })),
      });
      marketSentiments.value = result || [];
    }
  } catch (e) {
    console.error('Failed to analyze markets:', e);
  }
  isLoading.value = false;
};

// 分析文本
const analyzeTextSentiment = async () => {
  if (!analyzeText.value.trim()) return;
  
  isAnalyzing.value = true;
  try {
    const result = await api.post<any>('/api/sentiment/analyze', {
      text: analyzeText.value,
    });
    analysisResult.value = result;
  } catch (e) {
    console.error('Failed to analyze text:', e);
  }
  isAnalyzing.value = false;
};

// 获取情绪颜色
const getSentimentColor = (score: number) => {
  if (score > 0.3) return 'text-green-400';
  if (score < -0.3) return 'text-red-400';
  return 'text-yellow-400';
};

const getSentimentBg = (score: number) => {
  if (score > 0.3) return 'bg-green-500/20';
  if (score < -0.3) return 'bg-red-500/20';
  return 'bg-yellow-500/20';
};

const formatVolume = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

onMounted(async () => {
  await Promise.all([fetchTrending(), analyzeMarkets()]);
});
</script>

<template>
  <div class="space-y-6">
    <!-- 页头 -->
    <div>
      <h1 class="text-2xl font-bold">📊 情绪分析</h1>
      <p class="text-white/40 text-sm mt-1">社交媒体情绪监控与市场预测</p>
    </div>

    <!-- 趋势话题 -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🔥 趋势话题</h2>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div 
          v-for="topic in trending" 
          :key="topic.topic"
          class="p-4 rounded-lg border border-white/10"
          :class="getSentimentBg(topic.sentiment)"
        >
          <p class="font-medium">{{ topic.topic }}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-white/40">{{ formatVolume(topic.volume) }} 讨论</span>
            <span :class="['text-sm font-mono', getSentimentColor(topic.sentiment)]">
              {{ topic.sentiment >= 0 ? '+' : '' }}{{ (topic.sentiment * 100).toFixed(0) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 文本分析 -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🧠 AI 情绪分析</h2>
      <div class="flex gap-4">
        <div class="flex-1">
          <textarea 
            v-model="analyzeText"
            placeholder="输入文本进行情绪分析..."
            class="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-4 resize-none focus:border-cyber-neon/50 focus:outline-none"
          ></textarea>
          <button 
            @click="analyzeTextSentiment"
            :disabled="isAnalyzing || !analyzeText.trim()"
            class="mt-3 px-6 py-2 bg-cyber-neon text-black font-bold rounded-lg disabled:opacity-50"
          >
            {{ isAnalyzing ? '分析中...' : '分析' }}
          </button>
        </div>
        
        <div v-if="analysisResult" class="w-80 p-4 bg-white/5 rounded-lg">
          <h3 class="font-medium mb-3">分析结果</h3>
          <div class="space-y-3">
            <div>
              <p class="text-xs text-white/40">情绪标签</p>
              <p :class="['text-2xl font-bold', getSentimentColor(analysisResult.score)]">
                {{ analysisResult.label }}
              </p>
            </div>
            <div>
              <p class="text-xs text-white/40">情绪得分</p>
              <p class="font-mono text-lg">{{ (analysisResult.score * 100).toFixed(0) }} / 100</p>
            </div>
            <div>
              <p class="text-xs text-white/40">分析理由</p>
              <p class="text-sm text-white/70">{{ analysisResult.reasoning }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 市场情绪分析 -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">📈 市场情绪</h2>
        <button 
          @click="analyzeMarkets"
          :disabled="isLoading"
          class="text-sm text-cyber-neon hover:underline disabled:opacity-50"
        >
          {{ isLoading ? '分析中...' : '刷新分析' }}
        </button>
      </div>
      
      <div v-if="isLoading" class="text-center py-12 text-white/40">
        <div class="w-8 h-8 border-2 border-cyber-neon border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4">正在分析市场情绪...</p>
      </div>
      
      <div v-else class="space-y-4">
        <div 
          v-for="ms in marketSentiments" 
          :key="ms.marketId"
          class="p-4 bg-white/5 rounded-lg border border-white/5"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="font-medium">{{ ms.marketQuestion }}</p>
              <p class="text-sm text-white/50 mt-1">{{ ms.sentiment.summary }}</p>
              
              <!-- 关键词 -->
              <div class="flex flex-wrap gap-2 mt-3">
                <span 
                  v-for="kw in ms.sentiment.keywords.slice(0, 5)" 
                  :key="kw"
                  class="text-xs px-2 py-1 bg-white/10 rounded"
                >
                  {{ kw }}
                </span>
              </div>
              
              <!-- 警报 -->
              <div v-if="ms.alerts.length > 0" class="mt-3">
                <p 
                  v-for="alert in ms.alerts" 
                  :key="alert"
                  class="text-sm text-yellow-400"
                >
                  {{ alert }}
                </p>
              </div>
            </div>
            
            <div class="text-right ml-4">
              <!-- 情绪标签 -->
              <span 
                :class="[
                  'px-3 py-1 rounded font-bold text-sm',
                  ms.sentiment.label === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                  ms.sentiment.label === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                ]"
              >
                {{ ms.sentiment.label === 'BULLISH' ? '看涨' : ms.sentiment.label === 'BEARISH' ? '看跌' : '中性' }}
              </span>
              
              <!-- 预测 -->
              <div class="mt-3">
                <p class="text-xs text-white/40">价格预测</p>
                <p :class="[
                  'font-bold',
                  ms.priceImpact.predicted === 'UP' ? 'text-green-400' :
                  ms.priceImpact.predicted === 'DOWN' ? 'text-red-400' : 'text-white/60'
                ]">
                  {{ ms.priceImpact.predicted === 'UP' ? '↑ 上涨' : ms.priceImpact.predicted === 'DOWN' ? '↓ 下跌' : '→ 稳定' }}
                </p>
                <p class="text-xs text-white/40">置信度 {{ ms.priceImpact.confidence.toFixed(0) }}%</p>
              </div>
            </div>
          </div>
        </div>
        
        <p v-if="marketSentiments.length === 0" class="text-center py-8 text-white/40">
          暂无市场情绪数据
        </p>
      </div>
    </div>
  </div>
</template>
