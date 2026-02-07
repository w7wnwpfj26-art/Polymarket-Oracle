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
  @apply bg-white/5 rounded-lg p-4 border border-white/10;
}

.btn-wallet-connect {
  @apply w-full py-3 px-4 bg-gradient-to-r from-cyber-neon to-green-400 
         text-black font-bold rounded-lg flex items-center justify-center
         hover:from-cyber-neon/80 hover:to-green-400/80
         transition-all duration-200 disabled:opacity-50;
}

.btn-secondary-small {
  @apply py-1.5 px-3 bg-white/10 text-white text-sm rounded
         hover:bg-white/20 transition-colors disabled:opacity-50;
}

.btn-danger-small {
  @apply py-1.5 px-3 bg-red-500/20 text-red-400 text-sm rounded
         hover:bg-red-500/30 transition-colors;
}

.help-text {
  @apply text-xs text-white/40 mt-2 text-center;
}

.connected-section {
  @apply space-y-4;
}

.wallet-info {
  @apply space-y-3;
}

.address-display {
  @apply flex items-center justify-between;
}

.status-indicator {
  @apply w-2 h-2 rounded-full;
}

.status-indicator.connected {
  @apply bg-cyber-neon;
}

.chain-tag {
  @apply text-xs px-2 py-1 bg-cyber-blue/20 text-cyber-blue rounded-full;
}

.balance-info {
  @apply flex items-center gap-2 text-sm;
}

.balance-label {
  @apply text-white/40;
}

.balance-amount {
  @apply font-mono font-bold;
}

.wallet-actions {
  @apply flex gap-2;
}

.authorization-status {
  @apply pt-3 border-t border-white/10 space-y-1;
}

.auth-indicator {
  @apply w-2 h-2 rounded-full;
}

.auth-indicator.authorized {
  @apply bg-cyber-neon;
}

.auth-indicator.expired {
  @apply bg-yellow-500;
}

.error-message {
  @apply mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg
         flex items-center gap-2 text-red-400 text-sm;
}

.error-icon {
  @apply text-lg;
}

.close-error {
  @apply ml-auto text-red-300 hover:text-white;
}

.spinner {
  @apply w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin;
}

.spinner-small {
  @apply w-3 h-3 border border-current border-t-transparent rounded-full animate-spin;
}

.wallet-icon {
  @apply text-current;
}
</style>