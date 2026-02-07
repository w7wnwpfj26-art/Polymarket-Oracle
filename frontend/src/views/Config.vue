<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useApi } from '@/composables/useApi';
import WalletConnector from '@/components/WalletConnector.vue';

const api = useApi();

const config = reactive({
  ai: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    apiKey: '',
    temperature: 0.1,
  },
  strategy: {
    riskManagement: {
      maxSemanticRisk: 30,
      minIrreversibilityScore: 80,
      maxSingleTradeAmount: 1000,
      maxTotalExposure: 10000,
      maxDailyLoss: 500,
      requireUnanimousApproval: true,
    },
    execution: {
      autoExecute: false,
      dryRunMode: true,
      confirmBeforeExecute: true,
    },
  },
  dataSources: {
    polymarket: {
      enabled: true,
      walletAddress: '',
      apiKey: '',
      apiSecret: '',
      apiPassphrase: '',
    },
    oddsApi: {
      enabled: true,
      apiKey: '',
    },
  },
});

const isSaving = ref(false);
const showSuccess = ref(false);

const saveConfig = async () => {
  isSaving.value = true;
  try {
    await api.put('/api/config', config);
    showSuccess.value = true;
    setTimeout(() => showSuccess.value = false, 3000);
  } catch (e) {
    console.error('Failed to save config:', e);
  } finally {
    isSaving.value = false;
  }
};

onMounted(async () => {
  try {
    const result = await api.get('/api/config');
    Object.assign(config, result);
  } catch (e) {
    console.error('Failed to fetch config:', e);
  }
});
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">系统配置</h1>
      <button @click="saveConfig" :disabled="isSaving" class="btn-primary flex items-center gap-2">
        <svg v-if="isSaving" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        💾 保存配置
      </button>
    </div>

    <!-- AI Config -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🤖 AI 模型配置</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">AI 提供商</label>
          <select v-model="config.ai.provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">阿里通义千问</option>
            <option value="local">本地 Ollama</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">模型</label>
          <select v-model="config.ai.model">
            <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="deepseek-reasoner">DeepSeek Reasoner</option>
            <option value="qwen-turbo">通义千问 Turbo</option>
            <option value="qwen-plus">通义千问 Plus</option>
            <option value="qwen-max">通义千问 Max</option>
            <option value="qwen2.5-72b-instruct">Qwen2.5 72B</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs text-white/40 uppercase mb-2">API Key</label>
          <input type="password" v-model="config.ai.apiKey" placeholder="sk-..." />
        </div>
      </div>
    </div>

    <!-- Risk Management -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🛡️ 风险管理</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">最大语义风险</label>
          <div class="flex items-center gap-4">
            <input type="range" v-model="config.strategy.riskManagement.maxSemanticRisk" min="0" max="100" step="5" class="flex-1" />
            <span class="mono w-12 text-right">{{ config.strategy.riskManagement.maxSemanticRisk }}</span>
          </div>
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">最小不可逆评分</label>
          <div class="flex items-center gap-4">
            <input type="range" v-model="config.strategy.riskManagement.minIrreversibilityScore" min="0" max="100" step="5" class="flex-1" />
            <span class="mono w-12 text-right">{{ config.strategy.riskManagement.minIrreversibilityScore }}</span>
          </div>
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">单笔最大金额 ($)</label>
          <input type="number" v-model="config.strategy.riskManagement.maxSingleTradeAmount" />
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">总敞口上限 ($)</label>
          <input type="number" v-model="config.strategy.riskManagement.maxTotalExposure" />
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">每日最大亏损 ($)</label>
          <input type="number" v-model="config.strategy.riskManagement.maxDailyLoss" />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <input type="checkbox" v-model="config.strategy.riskManagement.requireUnanimousApproval" id="unanimous" class="w-5 h-5" />
        <label for="unanimous">需要所有代理一致同意才能执行交易</label>
      </div>
    </div>

    <!-- Wallet Connector -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">💼 OKX钱包连接</h2>
      <div class="mb-4 p-4 bg-cyber-blue/10 border border-cyber-blue/20 rounded-lg">
        <div class="flex items-start gap-3">
          <span class="text-cyber-blue text-xl">🔑</span>
          <div class="text-sm">
            <p class="font-medium text-cyber-blue">一键授权功能</p>
            <p class="text-white/60 mt-1">只需首次授权，后续交易无需重复确认签名</p>
            <ul class="list-disc list-inside mt-2 text-white/50 space-y-1">
              <li>30分钟内免重复授权</li>
              <li>自动保存授权状态</li>
              <li>断开后可快速重连</li>
            </ul>
          </div>
        </div>
      </div>
      <WalletConnector />
    </div>

    <!-- Polymarket Config -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🔮 Polymarket 对接</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2 flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <div class="font-medium">启用 Polymarket</div>
            <div class="text-xs text-white/40">连接到 Polymarket 预测市场</div>
          </div>
          <label class="relative inline-flex cursor-pointer">
            <input type="checkbox" v-model="config.dataSources.polymarket.enabled" class="sr-only peer" />
            <div class="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-cyber-neon
                        peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs text-white/40 uppercase mb-2">钱包地址</label>
          <input type="text" v-model="config.dataSources.polymarket.walletAddress" placeholder="0x..." />
          <p class="text-xs text-white/30 mt-1">用于接收交易和查看持仓的以太坊钱包地址</p>
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">API Key</label>
          <input type="password" v-model="config.dataSources.polymarket.apiKey" placeholder="API Key" />
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">API Secret</label>
          <input type="password" v-model="config.dataSources.polymarket.apiSecret" placeholder="API Secret" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs text-white/40 uppercase mb-2">API Passphrase</label>
          <input type="password" v-model="config.dataSources.polymarket.apiPassphrase" placeholder="API Passphrase" />
        </div>
      </div>
      <div class="mt-4 p-4 bg-cyber-blue/10 border border-cyber-blue/20 rounded-lg">
        <div class="flex items-start gap-3">
          <span class="text-cyber-blue text-xl">ℹ️</span>
          <div class="text-sm">
            <p class="font-medium text-cyber-blue">如何获取 Polymarket API 凭证：</p>
            <ol class="list-decimal list-inside mt-2 text-white/60 space-y-1">
              <li>访问 <a href="https://polymarket.com" target="_blank" class="text-cyber-neon underline">polymarket.com</a> 并连接钱包</li>
              <li>进入账户设置 → API 密钥</li>
              <li>创建新的 API 密钥并保存凭证</li>
              <li>将凭证填入上方表单</li>
            </ol>
            <p class="mt-2 text-cyber-yellow">⚠️ 注意：请妥善保管密钥，切勿泄露给他人</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Odds API Config -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">🎲 传统博彩 API (The Odds API)</h2>
      <div class="grid grid-cols-1 gap-4">
        <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <div class="font-medium">启用 Odds API</div>
            <div class="text-xs text-white/40">获取传统博彩平台赔率数据</div>
          </div>
          <label class="relative inline-flex cursor-pointer">
            <input type="checkbox" v-model="config.dataSources.oddsApi.enabled" class="sr-only peer" />
            <div class="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-cyber-neon
                        peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
        <div>
          <label class="block text-xs text-white/40 uppercase mb-2">API Key</label>
          <input type="password" v-model="config.dataSources.oddsApi.apiKey" placeholder="Your Odds API Key" />
          <p class="text-xs text-white/30 mt-1">
            免费注册获取：<a href="https://the-odds-api.com" target="_blank" class="text-cyber-neon underline">the-odds-api.com</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Execution -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">⚡ 执行设置</h2>
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <div class="font-medium">自动执行</div>
            <div class="text-xs text-white/40">发现套利机会时自动下单</div>
          </div>
          <label class="relative inline-flex cursor-pointer">
            <input type="checkbox" v-model="config.strategy.execution.autoExecute" class="sr-only peer" />
            <div class="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-cyber-neon
                        peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
        <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <div class="font-medium">模拟模式 (Dry Run)</div>
            <div class="text-xs text-white/40">只模拟交易，不实际下单</div>
          </div>
          <label class="relative inline-flex cursor-pointer">
            <input type="checkbox" v-model="config.strategy.execution.dryRunMode" class="sr-only peer" />
            <div class="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-cyber-neon
                        peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <Transition name="fade">
      <div v-if="showSuccess" class="fixed bottom-6 right-6 bg-cyber-neon text-black px-6 py-3 rounded-lg font-bold shadow-lg">
        ✅ 配置已保存
      </div>
    </Transition>
  </div>
</template>
