#!/usr/bin/env node

/**
 * Desktop Client Build Script
 * 负责构建和打包Electron桌面应用
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DESKTOP_DIR = path.join(PROJECT_ROOT, 'desktop');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');

class DesktopBuilder {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
  }

  async build() {
    try {
      console.log('🚀 开始构建AEGIS桌面客户端...');
      
      // 1. 准备构建环境
      await this.prepareEnvironment();
      
      // 2. 构建前端应用
      await this.buildFrontend();
      
      // 3. 复制前端构建产物
      await this.copyFrontendAssets();
      
      // 4. 安装桌面应用依赖
      await this.installDesktopDeps();
      
      // 5. 执行打包
      await this.packageApp();
      
      console.log('✅ 桌面客户端构建完成！');
      
    } catch (error) {
      console.error('❌ 构建失败:', error.message);
      process.exit(1);
    }
  }

  async prepareEnvironment() {
    console.log('🔧 准备构建环境...');
    
    // 确保必要目录存在
    const dirs = [
      path.join(DESKTOP_DIR, 'dist'),
      path.join(DESKTOP_DIR, 'assets')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async buildFrontend() {
    console.log('🏗️  构建前端应用...');
    
    process.chdir(FRONTEND_DIR);
    
    // 安装前端依赖
    console.log('📦 安装前端依赖...');
    execSync('npm install', { stdio: 'inherit' });
    
    // 构建生产版本
    console.log('🔨 构建前端生产版本...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  async copyFrontendAssets() {
    console.log('📋 复制前端资源...');
    
    const distSrc = path.join(FRONTEND_DIR, 'dist');
    const distDest = path.join(DESKTOP_DIR, 'dist');
    
    // 清理目标目录
    if (fs.existsSync(distDest)) {
      fs.rmSync(distDest, { recursive: true });
    }
    
    // 复制构建产物
    this.copyRecursiveSync(distSrc, distDest);
  }

  async installDesktopDeps() {
    console.log('📥 安装桌面应用依赖...');
    
    process.chdir(DESKTOP_DIR);
    execSync('npm install', { stdio: 'inherit' });
  }

  async packageApp() {
    console.log('📦 打包应用程序...');
    
    process.chdir(PROJECT_ROOT);
    
    // 根据平台执行不同的打包命令
    let buildCmd;
    
    switch (this.platform) {
      case 'darwin':
        buildCmd = 'npm run build:mac';
        break;
      case 'win32':
        buildCmd = 'npm run build:win';
        break;
      default:
        buildCmd = 'npm run build:all';
    }
    
    console.log(`🔧 执行命令: ${buildCmd}`);
    execSync(buildCmd, { stdio: 'inherit' });
  }

  copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(childItemName => {
        this.copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// 执行构建
const builder = new DesktopBuilder();

if (require.main === module) {
  builder.build().catch(console.error);
}

module.exports = DesktopBuilder;