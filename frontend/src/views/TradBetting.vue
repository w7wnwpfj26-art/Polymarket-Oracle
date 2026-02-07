<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import OddsChart from '@/components/charts/OddsChart.vue';

const { apiCall, loading } = useApi();

interface Site {
  name: string;
  loggedIn: boolean;
  monitoring: boolean;
}

interface NewSite {
  name: string;
  url: string;
  username: string;
  password: string;
  template: string;
  proxyServer: string;
  twoFactorType: string;
  twoFactorSecret: string;
}

interface CaptchaConfig {
  provider: string;
  apiKey: string;
  timeout: number;
}

interface OddsData {
  eventName: string;
  odds: number;
  originalOdds: string;
  format: string;
  impliedProbability: number;
  timestamp: string;
}

const status = ref<{ running: boolean; sites: Site[] }>({
  running: false,
  sites: [],
});

// UI 状态
const showAddSite = ref(false);
const showCaptchaConfig = ref(false);
const showOddsChart = ref(false);
const selectedSite = ref<string | null>(null);
const activeTab = ref<'sites' | 'odds' | 'logs'>('sites');

// 表单数据
const newSite = reactive<NewSite>({
  name: '',
  url: '',
  username: '',
  password: '',
  template: 'hga',
  proxyServer: '',
  twoFactorType: '',
  twoFactorSecret: '',
});

const captchaConfig = reactive<CaptchaConfig>({
  provider: 'twocaptcha',
  apiKey: '',
  timeout: 120000,
});

// 数据
const templates = ref<Record<string, any>>({});
const logs = ref<string[]>([]);
const siteOdds = ref<Map<string, OddsData[]>>(new Map());
const verificationCode = ref('');
const pendingVerification = ref<{ siteName: string; type: string } | null>(null);

// 日志
const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${icons[type]} ${message}`);
  if (logs.value.length > 100) logs.value.pop();
};

// ============ API 调用 ============

const fetchStatus = async () => {
  const response = await apiCall('/api/betting/status');
  if (response.success) {
    status.value = response.data;
  }
};

const fetchTemplates = async () => {
  const response = await apiCall('/api/betting/templates');
  if (response.success) {
    templates.value = response.data;
  }
};

const initializeBrowser = async () => {
  addLog('正在初始化浏览器...', 'info');
  const response = await apiCall('/api/betting/initialize', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headless: true }),
  });
  if (response.success) {
    addLog('浏览器初始化成功', 'success');
    await fetchStatus();
  } else {
    addLog('浏览器初始化失败', 'error');
  }
};

const configureCaptcha = async () => {
  addLog('配置验证码服务...', 'info');
  const response = await apiCall('/api/betting/captcha/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(captchaConfig),
  });
  if (response.success) {
    addLog('验证码服务配置成功', 'success');
    showCaptchaConfig.value = false;
  } else {
    addLog('验证码服务配置失败', 'error');
  }
};

const addSite = async () => {
  addLog(`正在添加平台: ${newSite.name}...`, 'info');
  
  const payload: any = {
    name: newSite.name,
    url: newSite.url,
    username: newSite.username,
    password: newSite.password,
    template: newSite.template,
  };
  
  if (newSite.proxyServer) {
    payload.proxyServer = newSite.proxyServer;
  }
  
  if (newSite.twoFactorType) {
    payload.twoFactor = {
      type: newSite.twoFactorType,
      secret: newSite.twoFactorSecret || undefined,
    };
  }
  
  const response = await apiCall('/api/betting/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (response.success) {
    addLog(`平台 ${newSite.name} 添加成功`, 'success');
    showAddSite.value = false;
    resetNewSiteForm();
    await fetchStatus();
  } else {
    addLog('添加平台失败', 'error');
  }
};

const resetNewSiteForm = () => {
  newSite.name = '';
  newSite.url = '';
  newSite.username = '';
  newSite.password = '';
  newSite.template = 'hga';
  newSite.proxyServer = '';
  newSite.twoFactorType = '';
  newSite.twoFactorSecret = '';
};

const loginSite = async (name: string) => {
  addLog(`正在登录 ${name}...`, 'info');
  const response = await apiCall(`/api/betting/sites/${name}/login`, { method: 'POST' });
  if (response.success && response.data.loggedIn) {
    addLog(`登录 ${name} 成功`, 'success');
  } else {
    addLog(`登录 ${name} 失败`, 'error');
  }
  await fetchStatus();
};

const startMonitoring = async (name: string) => {
  addLog(`开始监控 ${name}...`, 'info');
  await apiCall(`/api/betting/sites/${name}/monitor/start`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervalMs: 5000 }),
  });
  addLog(`${name} 监控已启动`, 'success');
  await fetchStatus();
};

const stopMonitoring = async (name: string) => {
  await apiCall(`/api/betting/sites/${name}/monitor/stop`, { method: 'POST' });
  addLog(`${name} 监控已停止`, 'warning');
  await fetchStatus();
};

const fetchSiteOdds = async (name: string) => {
  const response = await apiCall(`/api/betting/sites/${name}/odds`);
  if (response.success && response.data) {
    siteOdds.value.set(name, response.data);
    addLog(`获取 ${name} 赔率成功，共 ${response.data.length} 条`, 'success');
  }
};

const takeScreenshot = async (name: string) => {
  addLog(`正在截图 ${name}...`, 'info');
  const response = await apiCall(`/api/betting/sites/${name}/screenshot`, { method: 'POST' });
  if (response.success && response.data.path) {
    addLog(`截图已保存: ${response.data.path}`, 'success');
  }
};

const refreshSite = async (name: string) => {
  await apiCall(`/api/betting/sites/${name}/refresh`, { method: 'POST' });
  addLog(`${name} 页面已刷新`, 'info');
};

const closeSite = async (name: string) => {
  await apiCall(`/api/betting/sites/${name}`, { method: 'DELETE' });
  addLog(`${name} 已关闭`, 'warning');
  await fetchStatus();
};

const shutdown = async () => {
  if (!confirm('确定要关闭所有平台连接吗？')) return;
  await apiCall('/api/betting/shutdown', { method: 'POST' });
  addLog('服务已关闭', 'warning');
  await fetchStatus();
};

const submitVerificationCode = async () => {
  if (!pendingVerification.value || !verificationCode.value) return;
  
  const { siteName, type } = pendingVerification.value;
  await apiCall(`/api/betting/sites/${siteName}/2fa/submit-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, code: verificationCode.value }),
  });
  
  addLog(`验证码已提交`, 'success');
  verificationCode.value = '';
  pendingVerification.value = null;
};

const viewOddsChart = (name: string) => {
  selectedSite.value = name;
  showOddsChart.value = true;
};

onMounted(() => {
  fetchStatus();
  fetchTemplates();
});

// 计算属性
const loggedInSites = computed(() => status.value.sites.filter(s => s.loggedIn));
const monitoringSites = computed(() => status.value.sites.filter(s => s.monitoring));
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">传统平台</h1>
        <p class="text-white/40 text-sm mt-1">
          已登录: {{ loggedInSites.length }} | 监控中: {{ monitoringSites.length }}
        </p>
      </div>
      <div class="flex gap-3">
        <button 
          @click="initializeBrowser"
          :disabled="loading || status.running"
          class="btn-primary"
        >
          {{ status.running ? '✅ 浏览器运行中' : '🚀 初始化浏览器' }}
        </button>
        <button 
          @click="showCaptchaConfig = true"
          :disabled="!status.running"
          class="btn-secondary"
        >
          🔐 验证码配置
        </button>
        <button 
          @click="showAddSite = true"
          :disabled="!status.running"
          class="btn-secondary"
        >
          ➕ 添加平台
        </button>
        <button 
          @click="shutdown"
          :disabled="!status.running"
          class="btn-danger-custom"
        >
          🛑 关闭服务
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-white/10 pb-2">
      <button 
        @click="activeTab = 'sites'"
        :class="['px-4 py-2 rounded-t', activeTab === 'sites' ? 'bg-white/10 text-white' : 'text-white/40']"
      >
        📊 平台管理
      </button>
      <button 
        @click="activeTab = 'odds'"
        :class="['px-4 py-2 rounded-t', activeTab === 'odds' ? 'bg-white/10 text-white' : 'text-white/40']"
      >
        📈 赔率监控
      </button>
      <button 
        @click="activeTab = 'logs'"
        :class="['px-4 py-2 rounded-t', activeTab === 'logs' ? 'bg-white/10 text-white' : 'text-white/40']"
      >
        📋 操作日志
      </button>
    </div>

    <!-- Sites Tab -->
    <div v-if="activeTab === 'sites'" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-if="status.sites.length === 0" class="col-span-full text-center text-white/40 py-12 card">
        <p class="text-lg">暂无配置的平台</p>
        <p class="text-sm mt-2">点击「添加平台」开始</p>
      </div>

      <div 
        v-for="site in status.sites" 
        :key="site.name"
        class="card hover:border-neon/30 transition-all"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="font-bold text-lg">{{ site.name }}</h3>
            <div class="flex gap-2 mt-2">
              <span 
                class="text-xs px-2 py-0.5 rounded"
                :class="site.loggedIn ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'"
              >
                {{ site.loggedIn ? '已登录' : '未登录' }}
              </span>
              <span 
                v-if="site.monitoring"
                class="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 animate-pulse"
              >
                监控中
              </span>
            </div>
          </div>
          <button 
            @click="closeSite(site.name)"
            class="text-red-400 hover:text-red-300 p-1"
            title="关闭"
          >
            ✕
          </button>
        </div>
        
        <div class="flex flex-wrap gap-2">
          <button 
            v-if="!site.loggedIn"
            @click="loginSite(site.name)"
            class="btn-sm btn-primary"
          >
            🔑 登录
          </button>
          
          <template v-if="site.loggedIn">
            <button 
              v-if="!site.monitoring"
              @click="startMonitoring(site.name)"
              class="btn-sm btn-secondary"
            >
              ▶️ 开始监控
            </button>
            <button 
              v-else
              @click="stopMonitoring(site.name)"
              class="btn-sm btn-warning"
            >
              ⏹️ 停止监控
            </button>
            <button 
              @click="fetchSiteOdds(site.name)"
              class="btn-sm btn-secondary"
            >
              📊 获取赔率
            </button>
            <button 
              @click="viewOddsChart(site.name)"
              class="btn-sm btn-secondary"
            >
              📈 图表
            </button>
            <button 
              @click="takeScreenshot(site.name)"
              class="btn-sm btn-secondary"
            >
              📸 截图
            </button>
            <button 
              @click="refreshSite(site.name)"
              class="btn-sm btn-secondary"
            >
              🔄 刷新
            </button>
          </template>
        </div>

        <!-- 实时赔率预览 -->
        <div v-if="siteOdds.get(site.name)?.length" class="mt-4 pt-4 border-t border-white/10">
          <p class="text-xs text-white/40 mb-2">最新赔率 ({{ siteOdds.get(site.name)?.length }} 条)</p>
          <div class="max-h-32 overflow-y-auto space-y-1">
            <div 
              v-for="(odd, i) in siteOdds.get(site.name)?.slice(0, 5)" 
              :key="i"
              class="flex justify-between text-sm"
            >
              <span class="text-white/60 truncate flex-1">{{ odd.eventName }}</span>
              <span class="neon-text font-mono ml-2">{{ odd.odds.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Odds Tab -->
    <div v-if="activeTab === 'odds'" class="space-y-6">
      <div v-if="monitoringSites.length === 0" class="text-center text-white/40 py-12 card">
        <p class="text-lg">暂无监控中的平台</p>
        <p class="text-sm mt-2">请先登录并开始监控平台</p>
      </div>

      <div v-for="site in monitoringSites" :key="site.name" class="card">
        <h3 class="font-bold text-lg mb-4">{{ site.name }} - 赔率走势</h3>
        <OddsChart :site-name="site.name" :height="300" />
      </div>
    </div>

    <!-- Logs Tab -->
    <div v-if="activeTab === 'logs'" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">📋 操作日志</h2>
        <button @click="logs = []" class="text-sm text-white/40 hover:text-white">
          清空日志
        </button>
      </div>
      <div class="h-96 overflow-y-auto font-mono text-sm bg-black/30 rounded p-3 space-y-1">
        <div 
          v-for="(log, i) in logs" 
          :key="i"
          class="text-white/70 hover:bg-white/5 px-2 py-1 rounded"
        >
          {{ log }}
        </div>
        <div v-if="logs.length === 0" class="text-white/30 text-center py-4">
          暂无日志
        </div>
      </div>
    </div>

    <!-- Usage Guide -->
    <div class="card">
      <h2 class="text-lg font-bold mb-4">📖 使用指南</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
        <div>
          <h3 class="font-bold neon-text mb-2">1️⃣ 初始化浏览器</h3>
          <p class="text-white/60">
            启动 Playwright 无头浏览器，这是执行任何操作的前提。
          </p>
        </div>
        <div>
          <h3 class="font-bold neon-text mb-2">2️⃣ 配置验证码</h3>
          <p class="text-white/60">
            配置 2captcha/Anti-Captcha API 以自动解决验证码。
          </p>
        </div>
        <div>
          <h3 class="font-bold neon-text mb-2">3️⃣ 添加平台</h3>
          <p class="text-white/60">
            配置平台 URL、账户密码，选择预设模板或自定义选择器。
          </p>
        </div>
        <div>
          <h3 class="font-bold neon-text mb-2">4️⃣ 登录并监控</h3>
          <p class="text-white/60">
            登录后开始监控赔率变化，系统会实时记录赔率历史。
          </p>
        </div>
      </div>
    </div>

    <!-- Add Site Modal -->
    <div 
      v-if="showAddSite"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      @click.self="showAddSite = false"
    >
      <div class="bg-[#1a1a2e] p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">➕ 添加传统平台</h2>
        
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-white/40 uppercase mb-2">平台名称 *</label>
              <input 
                v-model="newSite.name"
                type="text"
                placeholder="例如: 皇冠体育"
                class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
              />
            </div>
            <div>
              <label class="block text-xs text-white/40 uppercase mb-2">平台模板</label>
              <select 
                v-model="newSite.template"
                class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
              >
                <option value="hga">皇冠类 (HGA)</option>
                <option value="bet365">Bet365</option>
                <option value="williamhill">威廉希尔</option>
                <option value="sportsbook">通用体育平台</option>
              </select>
            </div>
          </div>
          
          <div>
            <label class="block text-xs text-white/40 uppercase mb-2">平台 URL *</label>
            <input 
              v-model="newSite.url"
              type="text"
              placeholder="https://example.com"
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
            />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-white/40 uppercase mb-2">用户名 *</label>
              <input 
                v-model="newSite.username"
                type="text"
                class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
              />
            </div>
            <div>
              <label class="block text-xs text-white/40 uppercase mb-2">密码 *</label>
              <input 
                v-model="newSite.password"
                type="password"
                class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs text-white/40 uppercase mb-2">代理服务器 (可选)</label>
            <input 
              v-model="newSite.proxyServer"
              type="text"
              placeholder="http://proxy:port 或 socks5://proxy:port"
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
            />
          </div>

          <div class="border-t border-white/10 pt-4">
            <h3 class="font-bold text-sm mb-3">二次验证 (可选)</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-white/40 uppercase mb-2">验证类型</label>
                <select 
                  v-model="newSite.twoFactorType"
                  class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
                >
                  <option value="">不使用</option>
                  <option value="totp">TOTP (Google Authenticator)</option>
                  <option value="sms">短信验证</option>
                  <option value="email">邮箱验证</option>
                  <option value="manual">手动输入</option>
                </select>
              </div>
              <div v-if="newSite.twoFactorType === 'totp'">
                <label class="block text-xs text-white/40 uppercase mb-2">TOTP Secret</label>
                <input 
                  v-model="newSite.twoFactorSecret"
                  type="text"
                  placeholder="Base32 密钥"
                  class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showAddSite = false" class="btn-secondary">
            取消
          </button>
          <button 
            @click="addSite" 
            :disabled="!newSite.name || !newSite.url || !newSite.username || !newSite.password" 
            class="btn-primary"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- Captcha Config Modal -->
    <div 
      v-if="showCaptchaConfig"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      @click.self="showCaptchaConfig = false"
    >
      <div class="bg-[#1a1a2e] p-6 rounded-xl w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">🔐 验证码服务配置</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-white/40 uppercase mb-2">服务提供商</label>
            <select 
              v-model="captchaConfig.provider"
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
            >
              <option value="twocaptcha">2Captcha</option>
              <option value="anticaptcha">Anti-Captcha</option>
              <option value="capsolver">Capsolver</option>
              <option value="manual">手动输入</option>
            </select>
          </div>
          
          <div v-if="captchaConfig.provider !== 'manual'">
            <label class="block text-xs text-white/40 uppercase mb-2">API Key</label>
            <input 
              v-model="captchaConfig.apiKey"
              type="password"
              placeholder="输入 API Key"
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label class="block text-xs text-white/40 uppercase mb-2">超时时间 (秒)</label>
            <input 
              v-model.number="captchaConfig.timeout"
              type="number"
              min="30"
              max="300"
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
            />
          </div>

          <div class="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-sm">
            <p class="text-blue-400 font-bold mb-1">💡 提示</p>
            <p class="text-white/60">
              推荐使用 2Captcha 或 Anti-Captcha。
              <br />注册地址：
              <a href="https://2captcha.com" target="_blank" class="text-blue-400 underline">2captcha.com</a>
            </p>
          </div>
        </div>
        
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showCaptchaConfig = false" class="btn-secondary">
            取消
          </button>
          <button @click="configureCaptcha" class="btn-primary">
            保存配置
          </button>
        </div>
      </div>
    </div>

    <!-- Odds Chart Modal -->
    <div 
      v-if="showOddsChart && selectedSite"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      @click.self="showOddsChart = false"
    >
      <div class="bg-[#1a1a2e] p-6 rounded-xl w-full max-w-4xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold">📈 {{ selectedSite }} - 赔率走势</h2>
          <button @click="showOddsChart = false" class="text-white/40 hover:text-white">✕</button>
        </div>
        <OddsChart :site-name="selectedSite" :height="400" />
      </div>
    </div>

    <!-- Verification Code Modal -->
    <div 
      v-if="pendingVerification"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
    >
      <div class="bg-[#1a1a2e] p-6 rounded-xl w-full max-w-sm">
        <h2 class="text-xl font-bold mb-4">🔐 输入验证码</h2>
        <p class="text-white/60 text-sm mb-4">
          请输入 {{ pendingVerification.siteName }} 的
          {{ pendingVerification.type === 'sms' ? '短信' : pendingVerification.type === 'email' ? '邮箱' : '' }}
          验证码
        </p>
        
        <input 
          v-model="verificationCode"
          type="text"
          placeholder="验证码"
          class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-center text-2xl tracking-widest"
          maxlength="6"
          @keyup.enter="submitVerificationCode"
        />
        
        <div class="flex justify-end gap-3 mt-6">
          <button @click="pendingVerification = null" class="btn-secondary">
            取消
          </button>
          <button @click="submitVerificationCode" :disabled="!verificationCode" class="btn-primary">
            提交
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-primary {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}
.btn-primary:hover {
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
  transform: translateY(-1px);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
.btn-secondary:disabled {
  opacity: 0.5;
}

.btn-danger-custom {
  background: rgba(255, 0, 85, 0.1);
  border: 1px solid rgba(255, 0, 85, 0.3);
  color: #ff0055;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}
.btn-danger-custom:hover {
  background: #ff0055;
  color: white;
}
.btn-danger-custom:disabled {
  opacity: 0.5;
}

.btn-warning {
  background: rgba(255, 200, 0, 0.1);
  border: 1px solid rgba(255, 200, 0, 0.3);
  color: #ffc800;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}
.btn-warning:hover {
  background: rgba(255, 200, 0, 0.2);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.neon-text {
  color: #00ff88;
}
</style>
