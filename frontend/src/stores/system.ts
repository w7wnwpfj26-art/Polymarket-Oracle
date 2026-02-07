import { defineStore } from 'pinia';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/composables/useApi';
import { useWebSocket } from '@/composables/useWebSocket';

interface AgentStatus {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  lastActivity: string;
  decisionsToday: number;
  approvalRate: number;
}

interface SystemStatus {
  isRunning: boolean;
  mode: 'LIVE' | 'DRY_RUN' | 'HALTED';
  uptime: number;
  lastScan: string;
  marketsScanned: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  totalProfit: number;
  agents: AgentStatus[];
}

export const useSystemStore = defineStore('system', () => {
  const api = useApi();
  const ws = useWebSocket('ws://localhost:7701'); // WebSocket端口
  
  // State
  const status = ref<SystemStatus | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdate = ref<Date | null>(null);

  // Dashboard stats
  const dashboardStats = ref({
    capital: 0,
    profitToday: 0,
    profitPercent: 0,
    marketsActive: 0,
    opportunitiesFound: 0,
    agentsOnline: 0,
    riskLevel: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
  });

  // Computed
  const isConnected = computed(() => status.value?.isRunning ?? false);
  const agentCount = computed(() => status.value?.agents.length ?? 0);
  const onlineAgents = computed(() => 
    status.value?.agents.filter(a => a.status === 'ONLINE').length ?? 0
  );

  // Actions
  async function fetchStatus() {
    try {
      const response = await api.get<SystemStatus>('/api/system/status');
      status.value = response;
      lastUpdate.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch status';
    }
  }

  async function fetchDashboard() {
    try {
      const response = await api.get('/api/system/dashboard');
      Object.assign(dashboardStats.value, response);
    } catch (e) {
      console.error('Failed to fetch dashboard:', e);
    }
  }

  async function emergencyHalt() {
    try {
      await api.post('/api/system/emergency-halt');
      await fetchStatus();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to halt system';
    }
  }

  async function setMode(mode: 'LIVE' | 'DRY_RUN') {
    try {
      await api.post('/api/system/mode', { mode });
      await fetchStatus();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to set mode';
    }
  }

  // WebSocket消息处理器
  const handleWsMessage = (message: any) => {
    switch (message.type) {
      case 'status':
        status.value = message.data;
        lastUpdate.value = new Date();
        break;
      case 'heartbeat':
        // 心跳包，更新最后活动时间
        if (status.value) {
          status.value.lastScan = new Date().toISOString();
        }
        break;
      case 'opportunity':
        // 新机会发现
        if (status.value) {
          status.value.opportunitiesFound += 1;
        }
        break;
      case 'trade':
        // 交易更新
        if (status.value) {
          status.value.tradesExecuted += 1;
          status.value.totalProfit += message.data.profit || 0;
        }
        break;
      case 'error':
        error.value = message.data?.message || 'Unknown error';
        break;
    }
  };

  function initialize() {
    // 初始获取一次状态
    fetchStatus();
    fetchDashboard();
    
    // 订阅WebSocket事件
    ws.subscribe(['status', 'opportunity', 'trade']);
    
    // 监听WebSocket消息
    ws.onMessage(handleWsMessage);
    
    // 降级：如果WebSocket连接失败，仍然使用轮询作为后备
    const pollInterval = setInterval(() => {
      if (!ws.isConnected.value) {
        fetchStatus();
        fetchDashboard();
      }
    }, 30000); // 30秒轮询一次作为后备
    
    // 清理函数
    onUnmounted(() => {
      clearInterval(pollInterval);
    });
  }

  return {
    status,
    isLoading,
    error,
    lastUpdate,
    dashboardStats,
    isConnected,
    agentCount,
    onlineAgents,
    fetchStatus,
    fetchDashboard,
    emergencyHalt,
    setMode,
    initialize,
  };
});
