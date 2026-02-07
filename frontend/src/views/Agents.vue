<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

interface Agent {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  lastActivity: string;
  decisionsToday: number;
  approvalRate: number;
}

const api = useApi();
const agents = ref<Agent[]>([]);
const isLoading = ref(true);

const toggleAgent = async (id: string, enabled: boolean) => {
  try {
    await api.post(`/api/agents/${id}/toggle`, { enabled });
    await fetchAgents();
  } catch (e) {
    console.error('Toggle failed:', e);
  }
};

const testAgent = async (id: string) => {
  try {
    const result = await api.post(`/api/agents/${id}/test`, { question: 'Test market?' });
    alert(`测试结果：${result.decision} (信心：${result.confidence}%)`);
  } catch (e) {
    console.error('Test failed:', e);
  }
};

const fetchAgents = async () => {
  try {
    const result = await api.get<Agent[]>('/api/agents');
    agents.value = result || [];
  } catch (e) {
    console.error('Failed to fetch agents:', e);
  }
};

onMounted(async () => {
  await fetchAgents();
  isLoading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">AI 代理</h1>
      <div class="text-sm text-white/40">
        {{ agents.filter(a => a.status === 'ONLINE').length }} / {{ agents.length }} 在线
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-20 text-white/40">
      <div class="w-8 h-8 border-2 border-cyber-neon border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="agent in agents" :key="agent.id" class="card card-hover">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span :class="[
              'w-3 h-3 rounded-full',
              agent.status === 'ONLINE' ? 'status-online' :
              agent.status === 'ERROR' ? 'status-error' : 'status-offline'
            ]"></span>
            <h3 class="font-bold">{{ agent.name }}</h3>
          </div>
          <label class="relative inline-flex cursor-pointer">
            <input 
              type="checkbox" 
              :checked="agent.status === 'ONLINE'"
              @change="toggleAgent(agent.id, ($event.target as HTMLInputElement).checked)"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-white/10 peer-focus:ring-2 peer-focus:ring-cyber-neon rounded-full peer 
                        peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
                        peer-checked:bg-cyber-neon"></div>
          </label>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-white/40">今日决策</span>
            <span class="mono">{{ agent.decisionsToday }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-white/40">通过率</span>
            <span :class="[
              'mono',
              agent.approvalRate >= 0.8 ? 'text-cyber-neon' :
              agent.approvalRate >= 0.5 ? 'text-cyber-yellow' : 'text-cyber-red'
            ]">
              {{ (agent.approvalRate * 100).toFixed(1) }}%
            </span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-white/40">最后活动</span>
            <span class="text-xs">{{ new Date(agent.lastActivity).toLocaleTimeString() }}</span>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/5 flex gap-2">
          <button @click="testAgent(agent.id)" class="flex-1 py-2 text-sm bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            测试
          </button>
          <RouterLink :to="`/agents/${agent.id}`" class="flex-1 py-2 text-sm text-center bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            详情
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
