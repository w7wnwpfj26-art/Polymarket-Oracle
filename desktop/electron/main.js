/**
 * Electron Main Process for AEGIS Desktop Client
 * 负责窗口管理、系统集成、后端服务管理
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// 全局引用防止垃圾回收
let mainWindow = null;
let tray = null;
let backendProcess = null;

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

  initializeApp() {
    // 应用生命周期事件
    app.whenReady().then(() => this.createWindow());
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
    
    // 自动更新配置
    this.setupAutoUpdater();
  }

  async createWindow() {
    // 创建主窗口
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      backgroundColor: '#1a202c'
    });

    // 加载应用界面
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      // 生产环境下加载打包后的前端
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // 窗口事件处理
    mainWindow.on('close', (event) => {
      if (!app.quitting) {
        event.preventDefault();
        mainWindow.hide();
        return false;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // 创建系统托盘
    this.createTray();

    // 启动后端服务
    await this.startBackendService();
  }

  createTray() {
    // 暂时使用系统默认图标，避免路径问题
    try {
      tray = new Tray(null);
      console.log('[Tray] Created with default system icon');
    } catch (error) {
      console.log('[Tray] Failed to create tray:', error.message);
      return; // 如果连默认图标都无法创建，就跳过托盘
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: '检查更新',
        click: () => this.checkForUpdates()
      },
      {
        label: '重启后端服务',
        click: () => this.restartBackendService()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.quitApp()
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setTooltip(APP_NAME);

    tray.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }

  async startBackendService() {
    try {
      console.log('[Backend] Starting backend service...');
      
      // 检查后端目录是否存在
      if (!fs.existsSync(BACKEND_DIR)) {
        throw new Error('Backend directory not found');
      }

      // 启动后端进程
      backendProcess = spawn('npm', ['run', 'start'], {
        cwd: BACKEND_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Backend] ${output}`);
        
        // 检测后端是否准备就绪
        if (output.includes('Server running') || output.includes('listening')) {
          this.backendReady = true;
          mainWindow.webContents.send('backend-ready', { 
            url: `http://localhost:${BACKEND_PORT}` 
          });
        }
      });

      backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString()}`);
      });

      backendProcess.on('close', (code) => {
        console.log(`[Backend] Process exited with code ${code}`);
        this.backendReady = false;
        mainWindow.webContents.send('backend-stopped');
      });

    } catch (error) {
      console.error('[Backend] Failed to start:', error);
      mainWindow.webContents.send('backend-error', { 
        message: error.message 
      });
    }
  }

  async restartBackendService() {
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    await this.startBackendService();
  }

  setupIPC() {
    // 获取应用信息
    ipcMain.handle('get-app-info', () => ({
      name: APP_NAME,
      version: app.getVersion(),
      isDev
    }));

    // 获取后端状态
    ipcMain.handle('get-backend-status', () => ({
      running: this.backendReady,
      port: BACKEND_PORT
    }));

    // 重启后端服务
    ipcMain.handle('restart-backend', async () => {
      await this.restartBackendService();
      return { success: true };
    });

    // 打开外部链接
    ipcMain.handle('open-external', async (_, url) => {
      await shell.openExternal(url);
      return { success: true };
    });

    // 选择文件夹
    ipcMain.handle('select-directory', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      });
      return result.filePaths[0] || null;
    });
  }

  setupAutoUpdater() {
    // 配置更新服务器
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'your-github-username',
      repo: 'aegis-arbitrage'
    });

    autoUpdater.on('checking-for-update', () => {
      console.log('[Updater] Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version);
      this.updateAvailable = true;
      mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[Updater] No updates available');
      mainWindow.webContents.send('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('[Updater] Error:', err);
      mainWindow.webContents.send('update-error', err.message);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      mainWindow.webContents.send('update-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded');
      mainWindow.webContents.send('update-downloaded', info);
    });

    // 启动时检查更新
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 5000);
    }
  }

  async checkForUpdates() {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[Updater] Check failed:', error);
    }
  }

  quitApp() {
    app.quitting = true;
    
    // 停止后端服务
    if (backendProcess) {
      backendProcess.kill();
    }
    
    app.quit();
  }
}

// 启动应用
new AEGISApp();