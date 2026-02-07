#!/usr/bin/env node

/**
 * Release Management Script
 * 自动化版本发布和GitHub Release创建
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const PROJECT_ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

class ReleaseManager {
  constructor() {
    this.currentVersion = this.getCurrentVersion();
  }

  getCurrentVersion() {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    return pkg.version;
  }

  async release(versionType = 'patch') {
    try {
      console.log(`🚀 准备发布新版本 (${versionType})...`);
      
      // 1. 验证工作目录干净
      await this.validateGitStatus();
      
      // 2. 更新版本号
      const newVersion = await this.bumpVersion(versionType);
      
      // 3. 构建应用
      await this.buildApplication();
      
      // 4. 创建Git标签
      await this.createGitTag(newVersion);
      
      // 5. 推送到GitHub
      await this.pushToGitHub(newVersion);
      
      // 6. 创建GitHub Release
      await this.createGitHubRelease(newVersion);
      
      console.log(`✅ 版本 ${newVersion} 发布成功！`);
      
    } catch (error) {
      console.error('❌ 发布失败:', error.message);
      process.exit(1);
    }
  }

  async validateGitStatus() {
    console.log('🔍 验证Git状态...');
    
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      throw new Error('工作目录有未提交的更改，请先提交或暂存所有更改');
    }
    
    const unpushed = execSync('git cherry -v', { encoding: 'utf8' });
    if (unpushed.trim()) {
      throw new Error('有未推送的提交，请先推送到远程仓库');
    }
  }

  async bumpVersion(type) {
    console.log(`🔢 更新版本号 (${type})...`);
    
    const newVersion = semver.inc(this.currentVersion, type);
    if (!newVersion) {
      throw new Error(`无效的版本类型: ${type}`);
    }
    
    // 更新package.json
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    pkg.version = newVersion;
    
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
    
    console.log(`📦 版本已更新: ${this.currentVersion} → ${newVersion}`);
    return newVersion;
  }

  async buildApplication() {
    console.log('🏗️  构建应用程序...');
    
    // 执行桌面客户端构建脚本
    const buildScript = path.join(__dirname, 'build-desktop.js');
    execSync(`node ${buildScript}`, { stdio: 'inherit' });
  }

  async createGitTag(version) {
    console.log(`🏷️  创建Git标签 v${version}...`);
    
    // 提交版本更新
    execSync(`git add package.json`, { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
    
    // 创建标签
    execSync(`git tag -a v${version} -m "Release version ${version}"`, { stdio: 'inherit' });
  }

  async pushToGitHub(version) {
    console.log('📤 推送到GitHub...');
    
    execSync('git push origin main', { stdio: 'inherit' });
    execSync(`git push origin v${version}`, { stdio: 'inherit' });
  }

  async createGitHubRelease(version) {
    console.log(`🌐 创建GitHub Release v${version}...`);
    
    // 生成发布说明
    const changelog = this.generateChangelog(version);
    
    // 使用GitHub CLI创建Release（需要安装gh cli）
    try {
      const releaseCmd = `gh release create v${version} \
        --title "v${version}" \
        --notes "${changelog.replace(/"/g, '\\"')}" \
        --draft=false \
        ./dist-electron/*.exe \
        ./dist-electron/*.dmg \
        ./dist-electron/*.zip`;
      
      execSync(releaseCmd, { stdio: 'inherit' });
      
    } catch (error) {
      console.warn('⚠️  GitHub Release创建失败，可能需要手动上传构建产物');
      console.log('请访问: https://github.com/your-username/aegis-arbitrage/releases/new');
    }
  }

  generateChangelog(version) {
    // 简单的变更日志生成（实际项目中建议使用conventional-changelog）
    return `## v${version}
    
### 新增功能
- 自动更新功能
- 跨平台桌面客户端支持

### 修复问题
- 性能优化
- Bug修复

### 技术改进
- 代码重构
- 依赖更新
`;
  }

  async showReleaseNotes(version) {
    const changelog = this.generateChangelog(version);
    console.log('\n📋 发布说明预览:');
    console.log('==================');
    console.log(changelog);
    console.log('==================\n');
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch'; // patch, minor, major
  
  const manager = new ReleaseManager();
  manager.release(versionType).catch(console.error);
}

module.exports = ReleaseManager;