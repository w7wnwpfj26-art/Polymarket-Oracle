/**
 * Electron Main Process for AEGIS Desktop Client v2
 * 集成数据持久化和GitLab自动更新
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const AutoUpdaterService = require('../updater/autoUpdater');
const { getInstance: getDataStore } = require('../services/dataStore');

// 全局引用防止垃圾回收
let mainWindow = null;
let tray = null;
let backendProcess = null;
let autoUpdater = null;
let dataStore = null;

// 应用配置
const APP_NAME = 'AEGIS Arbitrage';
const BACKEND_PORT = 7700;
const BACKEND_DIR = path.join(__dirname, '../../backend');

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development';

class AEGISApp {
  constructor() {
    this.backendReady = false;
    this.updateAvailable = false;
    this.initializeApp();
  }

  async initializeApp() {
    // 初始化数据存储
    this.initializeDataStore();

    // 应用生命周期事件
    app.whenReady().then(() => {
      this.createWindow();
      this.createTray();
      this.startBackendService();
      
      // 初始化自动更新
      autoUpdater = new AutoUpdaterService(mainWindow);
      
      // 5秒后进行首次更新检查
      setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 5000);
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.quitApp();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // IPC 通信处理
    this.setupIPC();
  }

  /**
   * 初始化数据存储服务
   */
  initializeDataStore() {
    try {
      dataStore = getDataStore();
      
      // 使用应用名称作为加密密钥的一部分（实际应用中应使用更安全的密钥管理）
      const encryptionKey = process.env.ENCRYPTION_KEY || app.getName();
      
      dataStore.initialize(encryptionKey);
      
      console.log('[DataStore] Initialized successfully');
      console.log('[DataStore] Store path:', dataStore.getStorePath());
      console.log('[DataStore] Stats:', dataStore.getStats());
      
      // 更新最后登录时间
      dataStore.updateLastLoginTime();
    } catch (error) {
      console.error('[DataStore] Failed to initialize:', error);
      dialog.showErrorBox('数据存储初始化失败', 
        '无法初始化本地数据存储，部分功能可能受影响。\n\n' + error.message);
    }
  }

  /**
   * 创建主窗口
   */
  async createWindow() {
    // 从数据存储恢复窗口边界
    const savedBounds = dataStore ? dataStore.getWindowBounds() : null;
    const bounds = savedBounds || { width: 1400, height: 900 };

    mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      title: APP_NAME,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload-v2.js')
      },
      show: false
    });

    // 窗口加载完成后显示
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });

    // 加载前端应用
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // 窗口关闭时保存边界
    mainWindow.on('close', () => {
      if (dataStore) {
        const bounds = mainWindow.getBounds();
        dataStore.saveWindowBounds(bounds);
      }
    });

    // 窗口关闭事件
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // 拦截外部链接
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  /**
   * 创建系统托盘
   */
  createTray() {
    try {
      tray = new Tray(null); // 使用系统默认图标
      console.log('[Tray] Created with default system icon');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示主窗口',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        { type: 'separator' },
        {
          label: '后端服务',
          submenu: [
            {
              label: this.backendReady ? '✓ 运行中' : '✗ 未启动',
              enabled: false
            },
            {
              label: '重启后端',
              click: () => this.restartBackend()
            }
          ]
        },
        {
          label: '检查更新',
          click: () => {
            if (autoUpdater) {
              autoUpdater.checkForUpdates(true);
            }
          }
        },
        {
          label: '数据管理',
          submenu: [
            {
              label: '导出数据',
              click: () => this.exportData()
            },
            {
              label: '导入数据',
              click: () => this.importData()
            },
            { type: 'separator' },
            {
              label: '查看存储位置',
              click: () => {
                if (dataStore) {
                  shell.showItemInFolder(dataStore.getStorePath());
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => this.quitApp()
        }
      ]);

      tray.setToolTip(APP_NAME);
      tray.setContextMenu(contextMenu);

      // 点击托盘图标显示窗口
      tray.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    } catch (error) {
      console.log('[Tray] Failed to create tray:', error.message);
    }
  }

  /**
   * 启动后端服务
   */
  async startBackendService() {
    console.log('[Backend] Starting service...');
    console.log('[Backend] Directory:', BACKEND_DIR);

    try {
      // 检查后端目录是否存在
      if (!fs.existsSync(BACKEND_DIR)) {
        throw new Error(`Backend directory not found: ${BACKEND_DIR}`);
      }

      // 启动后端进程
      backendProcess = spawn('npm', ['run', 'start'], {
        cwd: BACKEND_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PORT: BACKEND_PORT,
          NODE_ENV: isDev ? 'development' : 'production'
        }
      });

      // 监听后端输出
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Backend]', output);

        if (output.includes('Server started') || output.includes(`listening on port ${BACKEND_PORT}`)) {
          this.backendReady = true;
          console.log('[Backend] Service ready');
          
          // 通知渲染进程
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backend-status', { ready: true });
          }
        }
      });

      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend Error]', data.toString());
      });

      backendProcess.on('error', (error) => {
        console.error('[Backend] Failed to start:', error);
        this.backendReady = false;
      });

      backendProcess.on('exit', (code) => {
        console.log(`[Backend] Process exited with code ${code}`);
        this.backendReady = false;
        
        // 如果非正常退出，5秒后尝试重启
        if (code !== 0 && code !== null) {
          setTimeout(() => {
            console.log('[Backend] Attempting to restart...');
            this.startBackendService();
          }, 5000);
        }
      });

    } catch (error) {
      console.error('[Backend] Startup error:', error);
      this.backendReady = false;
    }
  }

  /**
   * 重启后端服务
   */
  async restartBackend() {
    console.log('[Backend] Restarting...');
    
    if (backendProcess) {
      backendProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.startBackendService();
  }

  /**
   * IPC通信设置
   */
  setupIPC() {
    // 获取后端状态
    ipcMain.handle('backend-status', () => {
      return {
        ready: this.backendReady,
        port: BACKEND_PORT
      };
    });

    // 获取更新状态
    ipcMain.handle('update-status', () => {
      return autoUpdater ? autoUpdater.getUpdateStatus() : null;
    });

    // 手动检查更新
    ipcMain.handle('check-updates', async () => {
      if (autoUpdater) {
        await autoUpdater.checkForUpdates(true);
      }
    });

    // 下载更新
    ipcMain.handle('download-update', async () => {
      if (autoUpdater) {
        await autoUpdater.downloadUpdate();
      }
    });

    // 安装更新并重启
    ipcMain.handle('install-update', async () => {
      if (autoUpdater) {
        autoUpdater.quitAndInstall();
      }
    });

    // 数据存储API
    ipcMain.handle('data:get-api-keys', () => {
      return dataStore ? dataStore.getApiKeys() : {};
    });

    ipcMain.handle('data:save-api-key', (event, platform, apiKey) => {
      if (dataStore) {
        dataStore.saveApiKey(platform, apiKey);
      }
    });

    ipcMain.handle('data:get-wallet-config', () => {
      return dataStore ? dataStore.getWalletConfig() : {};
    });

    ipcMain.handle('data:save-wallet-config', (event, address, privateKey) => {
      if (dataStore) {
        dataStore.saveWalletConfig(address, privateKey);
      }
    });

    ipcMain.handle('data:get-arbitrage-config', () => {
      return dataStore ? dataStore.getArbitrageConfig() : {};
    });

    ipcMain.handle('data:save-arbitrage-config', (event, config) => {
      if (dataStore) {
        dataStore.saveArbitrageConfig(config);
      }
    });

    ipcMain.handle('data:get-trade-history', (event, limit) => {
      return dataStore ? dataStore.getTradeHistory(limit) : [];
    });

    ipcMain.handle('data:add-trade-record', (event, trade) => {
      if (dataStore) {
        dataStore.addTradeRecord(trade);
      }
    });

    ipcMain.handle('data:get-stats', () => {
      return dataStore ? dataStore.getStats() : null;
    });

    // 主题设置
    ipcMain.handle('theme:get', () => {
      return dataStore ? dataStore.getTheme() : 'dark';
    });

    ipcMain.handle('theme:set', (event, theme) => {
      if (dataStore) {
        dataStore.saveTheme(theme);
      }
    });
  }

  /**
   * 导出数据
   */
  async exportData() {
    if (!dataStore) {
      dialog.showErrorBox('错误', '数据存储服务未初始化');
      return;
    }

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: '导出数据',
      defaultPath: `aegis-backup-${Date.now()}.json`,
      filters: [
        { name: 'JSON文件', extensions: ['json'] }
      ]
    });

    if (canceled || !filePath) return;

    try {
      const data = dataStore.exportAllData();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '导出成功',
        message: `数据已导出到：\n${filePath}`
      });
    } catch (error) {
      dialog.showErrorBox('导出失败', error.message);
    }
  }

  /**
   * 导入数据
   */
  async importData() {
    if (!dataStore) {
      dialog.showErrorBox('错误', '数据存储服务未初始化');
      return;
    }

    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: '导入数据',
      properties: ['openFile'],
      filters: [
        { name: 'JSON文件', extensions: ['json'] }
      ]
    });

    if (canceled || filePaths.length === 0) return;

    try {
      const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(fileContent);
      
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '确认导入',
        message: '导入数据将覆盖当前设置，是否继续？',
        buttons: ['取消', '确定'],
        defaultId: 0,
        cancelId: 0
      });

      if (result.response === 1) {
        dataStore.importData(data);
        
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '导入成功',
          message: '数据导入成功，建议重启应用以确保所有设置生效。',
          buttons: ['稍后重启', '立即重启'],
          defaultId: 1
        }).then(({ response }) => {
          if (response === 1) {
            app.relaunch();
            app.quit();
          }
        });
      }
    } catch (error) {
      dialog.showErrorBox('导入失败', error.message);
    }
  }

  /**
   * 退出应用
   */
  quitApp() {
    console.log('[App] Quitting...');
    
    // 停止后端服务
    if (backendProcess) {
      backendProcess.kill();
    }
    
    app.quit();
  }
}

// 启动应用
const aegisApp = new AEGISApp();

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[UncaughtException]', error);
  dialog.showErrorBox('应用错误', `发生未预期的错误：\n${error.message}`);
});
