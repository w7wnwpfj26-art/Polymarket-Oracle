/**
 * Auto Updater Service for AEGIS Desktop
 * 负责版本检测、下载和安装更新
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

class AutoUpdaterService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.downloadProgress = 0;
    
    this.initializeUpdater();
  }

  initializeUpdater() {
    // 配置更新服务器（GitHub Releases 或自托管）
    const updateBaseUrl = process.env.UPDATE_URL || 'https://github.com/YOUR_USERNAME/aegis-arbitrage/releases';
    
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateBaseUrl
    });

    // 设置更新检查间隔（检2小时检查一次）
    setInterval(() => {
      this.checkForUpdates();
    }, 2 * 60 * 60 * 1000);

    // 绑定事件处理器
    this.bindUpdaterEvents();
  }

  bindUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...');
      this.sendStatusToRenderer('checking');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Update available:', info.version);
      this.updateAvailable = true;
      this.sendStatusToRenderer('available', info);
      
      // 显示更新提示对话框
      this.showUpdateDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater] No updates available');
      this.sendStatusToRenderer('not-available', info);
    });

    autoUpdater.on('error', (error) => {
      console.error('[AutoUpdater] Error:', error);
      this.sendStatusToRenderer('error', { message: error.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      console.log(`[AutoUpdater] Download progress: ${progressObj.percent}%`);
      this.sendStatusToRenderer('progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded');
      this.sendStatusToRenderer('downloaded', info);
      
      // 询问用户是否立即重启安装更新
      this.showInstallDialog(info);
    });
  }

  async checkForUpdates(manualCheck = false) {
    try {
      if (manualCheck) {
        this.sendStatusToRenderer('manual-check');
      }
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[AutoUpdater] Check failed:', error);
      this.sendStatusToRenderer('error', { message: error.message });
    }
  }

  async downloadUpdate() {
    try {
      console.log('[AutoUpdater] Starting download...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('[AutoUpdater] Download failed:', error);
      this.sendStatusToRenderer('error', { message: error.message });
    }
  }

  async quitAndInstall() {
    console.log('[AutoUpdater] Quitting and installing update...');
    autoUpdater.quitAndInstall();
  }

  showUpdateDialog(updateInfo) {
    const message = `发现新版本 ${updateInfo.version}
    
更新内容：
${updateInfo.releaseNotes || '包含性能优化和bug修复'}

是否现在下载更新？`;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '发现更新',
      message,
      buttons: ['稍后提醒我', '立即下载'],
      cancelId: 0,
      defaultId: 1
    }).then(({ response }) => {
      if (response === 1) {
        this.downloadUpdate();
      }
    });
  }

  showInstallDialog(updateInfo) {
    const message = `版本 ${updateInfo.version} 已下载完成
    
更新将在重启应用后生效，是否现在重启？`;

    dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      title: '更新准备就绪',
      message,
      buttons: ['稍后重启', '立即重启'],
      cancelId: 0,
      defaultId: 1
    }).then(({ response }) => {
      if (response === 1) {
        this.quitAndInstall();
      }
    });
  }

  sendStatusToRenderer(status, data = null) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('auto-updater-status', {
        status,
        data,
        timestamp: Date.now()
      });
    }
  }

  // 获取当前版本信息
  getCurrentVersion() {
    return {
      version: app.getVersion(),
      name: app.getName(),
      isPackaged: app.isPackaged
    };
  }

  // 获取更新状态
  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      downloadProgress: this.downloadProgress,
      currentVersion: this.getCurrentVersion()
    };
  }
}

module.exports = AutoUpdaterService;