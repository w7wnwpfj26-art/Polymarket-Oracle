<template>
  <div class="wallet-connector">
    <!-- 未连接状态 -->
    <div v-if="!walletState.connected" class="connect-section">
      <button 
        @click="connectWallet" 
        :disabled="connecting"
        class="btn-wallet-connect"
      >
        <span v-if="connecting" class="spinner mr-2"></span>
        <svg v-else class="wallet-icon mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="16" r="1" />
          <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
        </svg>
        {{ connecting ? '连接中...' : '连接OKX钱包' }}
      </button>
      
      <p class="help-text">
        一次授权，后续交易无需重复确认
      </p>
    </div>

    <!-- 已连接状态 -->
    <div v-else class="connected-section">
      <div class="wallet-info">
        <div class="address-display">
          <div class="flex items-center gap-2">
            <div class="status-indicator connected"></div>
            <span class="font-mono text-sm">
              {{ shortenedAddress }}
            </span>
          </div>
          <span class="chain-tag">
            {{ chainName }}
          </span>
        </div>
        
        <div class="balance-info">
          <span class="balance-label">余额:</span>
          <span class="balance-amount">{{ balance }} ETH</span>
        </div>
      </div>

      <div class="wallet-actions">
        <button 
          @click="refreshBalance" 
          :disabled="refreshing"
          class="btn-secondary-small"
        >
          <span v-if="refreshing" class="spinner-small"></span>
          {{ refreshing ? '刷新中' : '刷新余额' }}
        </button>
        
        <button 
          @click="disconnectWallet" 
          class="btn-danger-small"
        >
          断开连接
        </button>
      </div>

      <!-- 授权状态 -->
      <div class="authorization-status">
        <div class="flex items-center gap-2">
          <div :class="[
            'auth-indicator',
            isAuthorized ? 'authorized' : 'expired'
          ]"></div>
          <span class="text-sm">
            {{ isAuthorized ? '✅ 授权有效' : '⚠️ 授权已过期' }}
          </span>
        </div>
        <span v-if="authExpiry" class="text-xs text-white/40">
          过期时间: {{ authExpiry }}
        </span>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <span class="error-icon">❌</span>
      <span>{{ error }}</span>
      <button @click="clearError" class="close-error">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useOKXWallet } from '@/services/okxWallet';

const { 
  state: walletState, 
  connect: connectWalletInternal, 
  disconnect: disconnectWalletInternal,
  getBalance: getWalletBalance,
  isAuthorized 
} = useOKXWallet();

const connecting = ref(false);
const refreshing = ref(false);
const error = ref<string | null>(null);

// 计算属性
const shortenedAddress = computed(() => {
  const addr = walletState.value.address;
  if (!addr) return '';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
});

const chainName = computed(() => {
  const chainId = walletState.value.chainId;
  switch (chainId) {
    case 1: return 'Ethereum';
    case 137: return 'Polygon';
    case 56: return 'BNB Chain';
    default: return `Chain ${chainId}`;
  }
});

const balance = ref('0.0000');

const authExpiry = computed(() => {
  if (!walletState.value.lastAuthorization) return '';
  const expiryTime = new Date(walletState.value.lastAuthorization.getTime() + 30 * 60 * 1000);
  return expiryTime.toLocaleTimeString();
});

// 方法
const connectWallet = async () => {
  connecting.value = true;
  error.value = null;
  
  try {
    await connectWalletInternal();
    await refreshBalance();
  } catch (err: any) {
    error.value = err.message || '连接失败';
    console.error('Wallet connection error:', err);
  } finally {
    connecting.value = false;
  }
};

const disconnectWallet = () => {
  disconnectWalletInternal();
  balance.value = '0.0000';
  error.value = null;
};

const refreshBalance = async () => {
  if (!walletState.value.connected) return;
  
  refreshing.value = true;
  try {
    const bal = await getWalletBalance();
    balance.value = bal;
  } catch (err: any) {
    error.value = '获取余额失败';
    console.error('Balance refresh error:', err);
  } finally {
    refreshing.value = false;
  }
};

const clearError = () => {
  error.value = null;
};

// 监听钱包状态变化
watch(() => walletState.value.connected, (connected) => {
  if (connected) {
    refreshBalance();
  }
});

// 组件挂载时自动刷新余额
onMounted(() => {
  if (walletState.value.connected) {
    refreshBalance();
  }
});
</script>

<style scoped>
.wallet-connector {
  background: rgba(255,255,255,0.05);
  border-radius: 0.5rem;
  padding: 1rem;
  border: 1px solid rgba(255,255,255,0.1);
}
.btn-wallet-connect {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(to right, #00ff88, #4ade80);
  color: black;
  font-weight: bold;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}
.btn-wallet-connect:disabled { opacity: 0.5; }
.btn-secondary-small {
  padding: 0.375rem 0.75rem;
  background: rgba(255,255,255,0.1);
  color: white;
  font-size: 0.875rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-secondary-small:hover { background: rgba(255,255,255,0.2); }
.btn-danger-small {
  padding: 0.375rem 0.75rem;
  background: rgba(239,68,68,0.2);
  color: #f87171;
  font-size: 0.875rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
}
.help-text { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 0.5rem; text-align: center; }
.connected-section { display: flex; flex-direction: column; gap: 1rem; }
.wallet-info { display: flex; flex-direction: column; gap: 0.75rem; }
.address-display { display: flex; align-items: center; justify-content: space-between; }
.status-indicator { width: 0.5rem; height: 0.5rem; border-radius: 9999px; }
.status-indicator.connected { background: #00ff88; }
.chain-tag { font-size: 0.75rem; padding: 0.25rem 0.5rem; background: rgba(0,136,255,0.2); color: #0088ff; border-radius: 9999px; }
.balance-info { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.balance-label { color: rgba(255,255,255,0.4); }
.balance-amount { font-family: monospace; font-weight: bold; }
.wallet-actions { display: flex; gap: 0.5rem; }
.authorization-status { padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 0.25rem; }
.auth-indicator { width: 0.5rem; height: 0.5rem; border-radius: 9999px; }
.auth-indicator.authorized { background: #00ff88; }
.auth-indicator.expired { background: #eab308; }
.error-message { margin-top: 0.75rem; padding: 0.75rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 0.5rem; display: flex; align-items: center; gap: 0.5rem; color: #f87171; font-size: 0.875rem; }
.error-icon { font-size: 1.125rem; }
.close-error { margin-left: auto; color: #fca5a5; background: none; border: none; cursor: pointer; }
.spinner { width: 1rem; height: 1rem; border: 2px solid rgba(0,0,0,0.3); border-top-color: black; border-radius: 50%; animation: spin 0.6s linear infinite; }
.spinner-small { width: 0.75rem; height: 0.75rem; border: 1px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>