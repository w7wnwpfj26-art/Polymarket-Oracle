#!/usr/bin/env node

/**
 * 版本管理脚本
 * 自动更新package.json版本号并创建Git标签
 * 
 * 使用方式:
 * npm run version:patch  // 1.0.0 -> 1.0.1
 * npm run version:minor  // 1.0.0 -> 1.1.0
 * npm run version:major  // 1.0.0 -> 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

// 获取版本类型参数
const versionType = process.argv[2] || 'patch';
const validTypes = ['patch', 'minor', 'major'];

if (!validTypes.includes(versionType)) {
  error(`Invalid version type: ${versionType}. Must be one of: ${validTypes.join(', ')}`);
}

// 检查工作目录是否干净
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim()) {
      error('Working directory is not clean. Please commit or stash changes first.');
    }
    success('Git working directory is clean');
  } catch (err) {
    error('Failed to check git status');
  }
}

// 更新版本号
function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      error('Invalid version type');
  }
}

// 更新package.json文件
function updatePackageJson(filePath, newVersion) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  info(`Updated ${filePath}: ${oldVersion} -> ${newVersion}`);
}

// 主流程
function main() {
  info(`Starting version bump: ${versionType}`);
  
  // 检查Git状态
  checkGitStatus();
  
  // 读取根package.json
  const rootPkgPath = path.join(__dirname, '../package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  const currentVersion = rootPkg.version;
  const newVersion = bumpVersion(currentVersion, versionType);
  
  info(`Version: ${currentVersion} -> ${newVersion}`);
  
  // 更新所有package.json
  const packagePaths = [
    '../package.json',
    '../desktop/package.json',
    '../backend/package.json',
    '../frontend/package.json'
  ];
  
  packagePaths.forEach(pkgPath => {
    const fullPath = path.join(__dirname, pkgPath);
    if (fs.existsSync(fullPath)) {
      updatePackageJson(fullPath, newVersion);
    }
  });
  
  success(`All package.json files updated to v${newVersion}`);
  
  // Git提交
  try {
    info('Creating git commit...');
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
    success('Git commit created');
    
    // 创建Git标签
    info('Creating git tag...');
    execSync(`git tag -a v${newVersion} -m "Release version ${newVersion}"`, { stdio: 'inherit' });
    success(`Git tag v${newVersion} created`);
    
    // 提示推送
    log('\n' + '='.repeat(60), 'yellow');
    log('📦 Version bump completed!', 'green');
    log('', 'reset');
    log('Next steps:', 'yellow');
    log('1. Review the changes', 'cyan');
    log('2. Push to GitLab:', 'cyan');
    log(`   git push origin main`, 'reset');
    log(`   git push origin v${newVersion}`, 'reset');
    log('', 'reset');
    log('3. GitLab CI/CD will automatically build and release', 'cyan');
    log('='.repeat(60), 'yellow');
    
  } catch (err) {
    error('Failed to create git commit/tag');
  }
}

main();
