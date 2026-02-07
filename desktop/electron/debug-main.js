/**
 * Simplified Electron Main Process for Debugging
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('[DEBUG] Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load a simple test page first
  mainWindow.loadURL('https://www.google.com');
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[DEBUG] Page loaded successfully');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('[DEBUG] App is ready');
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[DEBUG] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[DEBUG] Main process started');