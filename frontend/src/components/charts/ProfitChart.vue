<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DailyStat {
  date: string;
  netProfit: number;
  totalProfit: number;
  totalLoss: number;
  opportunitiesFound: number;
  opportunitiesExecuted: number;
}

const props = defineProps<{
  data: DailyStat[];
  height?: number;
}>();

const chartData = computed(() => {
  const labels = props.data.map(d => d.date).reverse();
  const profits = props.data.map(d => d.netProfit).reverse();
  
  // Calculate cumulative profit
  let cumulative = 0;
  const cumulativeProfits = profits.map(p => {
    cumulative += p;
    return cumulative;
  });

  return {
    labels,
    datasets: [
      {
        label: '累计收益 ($)',
        data: cumulativeProfits,
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00ff88',
        pointBorderColor: '#0a0e17',
        pointBorderWidth: 2,
      },
      {
        label: '每日收益 ($)',
        data: profits,
        borderColor: '#00bfff',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#00bfff',
        pointBorderColor: '#0a0e17',
        pointBorderWidth: 2,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: 'rgba(255, 255, 255, 0.8)',
        font: {
          family: 'JetBrains Mono, monospace',
          size: 11,
        },
        boxWidth: 12,
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(10, 14, 23, 0.95)',
      titleColor: '#00ff88',
      bodyColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: 'rgba(0, 255, 136, 0.3)',
      borderWidth: 1,
      padding: 12,
      titleFont: {
        family: 'JetBrains Mono, monospace',
        size: 12,
      },
      bodyFont: {
        family: 'JetBrains Mono, monospace',
        size: 11,
      },
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number;
          const sign = value >= 0 ? '+' : '';
          return `${context.dataset.label}: ${sign}$${value.toFixed(2)}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.5)',
        font: {
          family: 'JetBrains Mono, monospace',
          size: 10,
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.5)',
        font: {
          family: 'JetBrains Mono, monospace',
          size: 10,
        },
        callback: (value: string | number) => `$${value}`,
      },
    },
  },
};
</script>

<template>
  <div class="profit-chart" :style="{ height: `${height || 300}px` }">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.profit-chart {
  width: 100%;
}
</style>
