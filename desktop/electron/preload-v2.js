/**
 * Electron Preload Script
 * 在渲染进程中提供安全的主进程API访问
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 后端服务API
  getBackendStatus: () => ipcRenderer.invoke('backend-status'),
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', (event, data) => callback(data)),
  
  // 自动更新API
  getUpdateStatus: () => ipcRenderer.invoke('update-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onAutoUpdaterStatus: (callback) => ipcRenderer.on('auto-updater-status', (event, data) => callback(data)),
  
  // 数据持久化API
  data: {
    // API密钥管理
    getApiKeys: () => ipcRenderer.invoke('data:get-api-keys'),
    saveApiKey: (platform, apiKey) => ipcRenderer.invoke('data:save-api-key', platform, apiKey),
    
    // 钱包配置
    getWalletConfig: () => ipcRenderer.invoke('data:get-wallet-config'),
    saveWalletConfig: (address, privateKey) => ipcRenderer.invoke('data:save-wallet-config', address, privateKey),
    
    // 套利策略配置
    getArbitrageConfig: () => ipcRenderer.invoke('data:get-arbitrage-config'),
    saveArbitrageConfig: (config) => ipcRenderer.invoke('data:save-arbitrage-config', config),
    
    // 复制交易配置
    getCopyTradingConfig: () => ipcRenderer.invoke('data:get-copytrading-config'),
    saveCopyTradingConfig: (config) => ipcRenderer.invoke('data:save-copytrading-config', config),
    
    // 历史数据
    getTradeHistory: (limit) => ipcRenderer.invoke('data:get-trade-history', limit),
    addTradeRecord: (trade) => ipcRenderer.invoke('data:add-trade-record', trade),
    getArbitrageHistory: (limit) => ipcRenderer.invoke('data:get-arbitrage-history', limit),
    getProfitHistory: () => ipcRenderer.invoke('data:get-profit-history'),
    
    // 统计信息
    getStats: () => ipcRenderer.invoke('data:get-stats')
  },
  
  // 主题API
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme)
  },
  
  // 系统API
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  
  // 版本信息
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  }
});

console.log('[Preload] APIs exposed successfully');
