<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Chart from 'chart.js/auto';

const props = defineProps<{
  siteName: string;
  eventName?: string;
  height?: number;
}>();

const chartRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

interface OddsRecord {
  timestamp: string;
  odds: number;
  eventName: string;
}

const oddsHistory = ref<OddsRecord[]>([]);
const isLoading = ref(false);

const fetchOddsHistory = async () => {
  if (!props.siteName) return;
  
  isLoading.value = true;
  try {
    let url = `/api/betting/sites/${props.siteName}/odds/history?limit=100`;
    if (props.eventName) {
      url += `&event=${encodeURIComponent(props.eventName)}`;
    }
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      oddsHistory.value = result.data || [];
      updateChart();
    }
  } catch (error) {
    console.error('Failed to fetch odds history:', error);
  } finally {
    isLoading.value = false;
  }
};

const updateChart = () => {
  if (!chartRef.value || oddsHistory.value.length === 0) return;

  const ctx = chartRef.value.getContext('2d');
  if (!ctx) return;

  // 按事件分组
  const eventGroups = new Map<string, { timestamps: string[]; odds: number[] }>();
  
  for (const record of oddsHistory.value) {
    if (!eventGroups.has(record.eventName)) {
      eventGroups.set(record.eventName, { timestamps: [], odds: [] });
    }
    const group = eventGroups.get(record.eventName)!;
    group.timestamps.push(new Date(record.timestamp).toLocaleTimeString());
    group.odds.push(record.odds);
  }

  // 生成数据集
  const colors = [
    'rgb(0, 255, 136)',
    'rgb(0, 200, 255)',
    'rgb(255, 100, 100)',
    'rgb(255, 200, 0)',
    'rgb(200, 100, 255)',
  ];

  const datasets = Array.from(eventGroups.entries()).map(([eventName, data], index) => ({
    label: eventName.length > 30 ? eventName.substring(0, 30) + '...' : eventName,
    data: data.odds.reverse(),
    borderColor: colors[index % colors.length],
    backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
    tension: 0.4,
    fill: true,
    pointRadius: 2,
    pointHoverRadius: 6,
  }));

  // 销毁旧图表
  if (chartInstance) {
    chartInstance.destroy();
  }

  // 创建新图表
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: eventGroups.size > 0 
        ? Array.from(eventGroups.values())[0].timestamps.reverse()
        : [],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#00ff88',
          bodyColor: '#fff',
          borderColor: 'rgba(0, 255, 136, 0.3)',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.raw}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)', maxRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
          title: {
            display: true,
            text: '赔率',
            color: 'rgba(255, 255, 255, 0.5)',
          },
        },
      },
    },
  });
};

// 实时更新
let updateInterval: NodeJS.Timeout | null = null;

onMounted(() => {
  fetchOddsHistory();
  
  // 每 10 秒更新一次
  updateInterval = setInterval(fetchOddsHistory, 10000);
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

watch(() => props.siteName, fetchOddsHistory);
watch(() => props.eventName, fetchOddsHistory);
</script>

<template>
  <div class="odds-chart-container">
    <div v-if="isLoading && oddsHistory.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>加载赔率数据...</p>
    </div>
    
    <div v-else-if="oddsHistory.length === 0" class="empty-state">
      <p>暂无赔率历史数据</p>
      <p class="hint">开始监控后将自动记录赔率变化</p>
    </div>
    
    <canvas 
      v-show="oddsHistory.length > 0"
      ref="chartRef" 
      :style="{ height: `${props.height || 300}px` }"
    ></canvas>
  </div>
</template>

<style scoped>
.odds-chart-container {
  position: relative;
  min-height: 200px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(255, 255, 255, 0.4);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 255, 136, 0.2);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>
