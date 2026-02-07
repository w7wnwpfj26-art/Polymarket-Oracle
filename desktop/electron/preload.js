/**
 * Preload Script for AEGIS Desktop Client
 * 在隔离环境中暴露安全的API给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

// 安全的API暴露
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 后端服务管理
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  
  // 系统操作
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 事件监听
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', (_, data) => callback(data)),
  onBackendStopped: (callback) => ipcRenderer.on('backend-stopped', () => callback()),
  onBackendError: (callback) => ipcRenderer.on('backend-error', (_, data) => callback(data)),
  
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, progress) => callback(progress)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error)),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});