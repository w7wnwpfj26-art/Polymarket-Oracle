# AEGIS套利系统 - 快速开始指南

## 🚀 5分钟快速部署

### 步骤1: 环境准备（2分钟）

```bash
# 1. 安装Node.js 20+
# macOS
brew install node

# Windows
# 从 https://nodejs.org/ 下载安装

# 2. 克隆仓库
git clone https://github.com/YOUR_USERNAME/aegis-arbitrage.git
cd aegis-arbitrage/new

# 3. 安装所有依赖
cd backend && npm install
cd ../frontend && npm install
cd ../desktop && npm install
cd ..
```

### 步骤2: 本地开发（1分钟）

```bash
# 方式1: 手动启动（推荐用于开发）
# 终端1: 启动后端
cd backend && npm run dev

# 终端2: 启动前端
cd frontend && npm run dev

# 终端3: 启动桌面应用
cd desktop && npm run dev

# 方式2: 使用脚本（从根目录运行）
npm run dev:backend &
npm run dev:frontend &
npm run dev:desktop
```

### 步骤3: 发布新版本（2分钟）

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 添加新功能"

# 2. 更新版本号并创建tag
npm run version:patch   # 1.0.0 -> 1.0.1
# 或
npm run version:minor   # 1.0.0 -> 1.1.0
# 或
npm run version:major   # 1.0.0 -> 2.0.0

# 3. 推送到GitLab（触发自动构建）
git push origin main
git push origin --tags

# 4. 等待CI/CD构建完成（约15-20分钟）
# 访问: GitHub Actions 或 CI 面板
```

---

## 📱 客户端使用指南

### 首次安装

1. 从GitLab Releases下载安装包：
   - Windows: `AEGIS-Setup-1.0.0.exe`
   - macOS: `AEGIS-1.0.0.dmg`

2. 安装应用

3. 启动后配置API密钥：
   - 点击"设置"
   - 填入Polymarket、Kalshi等API密钥
   - 保存配置（数据会持久化到本地）

### 自动更新

应用会自动检测更新：
- ✅ 启动时自动检查
- ✅ 每2小时检查一次
- ✅ 手动检查：设置 → 检查更新

当有新版本时：
1. 显示更新通知
2. 点击"立即下载"
3. 下载完成后点击"立即重启"
4. 应用重启，数据完好无损

---

## 🎯 核心功能

### 1. 套利检测
- Dutch Book套利
- 跨市场套利
- 实时监控套利机会

### 2. 智能体系统
- 语义法官：分析市场语义
- 不可逆验证器：确保交易安全
- 红队模拟器：风险测试
- 故障安全监控：实时保护

### 3. 数据持久化
- API密钥自动保存
- 交易历史记录
- 策略配置保留
- 升级不丢失数据

---

## 🔧 常用命令

### 开发命令
```bash
npm run dev:backend   # 启动后端（端口7700）
npm run dev:frontend  # 启动前端（端口5173）
npm run dev:desktop   # 启动桌面应用
```

### 构建命令
```bash
npm run build:frontend  # 构建前端
npm run build:desktop   # 构建桌面应用
cd desktop && npm run build:win  # 构建Windows版本
cd desktop && npm run build:mac  # 构建macOS版本
cd desktop && npm run build:all  # 构建所有平台
```

### 版本管理
```bash
npm run version:patch   # Bug修复版本
npm run version:minor   # 新功能版本
npm run version:major   # 重大更新版本
```

---

## 🐛 常见问题速查

### 问题1: 端口被占用
```bash
# 查看端口占用
lsof -i :7700
lsof -i :5173

# 杀死进程
kill -9 <PID>
```

### 问题2: Electron启动失败
```bash
# 清理缓存
cd desktop
rm -rf node_modules
npm install
```

### 问题3: 构建失败
```bash
# 确保前端已构建
cd frontend && npm run build

# 重新构建桌面应用
cd ../desktop
rm -rf dist-electron
npm run build
```

### 问题4: 后端无法启动
```bash
# 检查Bun是否安装
bun --version

# 如未安装
curl -fsSL https://bun.sh/install | bash

# 重新安装依赖
cd backend
rm -rf node_modules
npm install
```

### 问题5: 数据丢失
```bash
# 查看数据存储位置
# macOS
open ~/Library/Application\ Support/AEGIS\ Arbitrage/

# Windows
explorer %APPDATA%\AEGIS Arbitrage

# 如果有备份，导入即可
```

---

## 📊 系统监控

### 后端健康检查
```bash
# 基础健康检查
curl http://localhost:7700/health

# 详细健康检查
curl http://localhost:7700/health/detailed

# Prometheus指标
curl http://localhost:7700/health/metrics
```

### 查看日志
```bash
# 后端日志
tail -f backend/logs/app.log

# Electron日志（macOS）
tail -f ~/Library/Logs/AEGIS\ Arbitrage/main.log

# Electron日志（Windows）
type %USERPROFILE%\AppData\Roaming\AEGIS Arbitrage\logs\main.log
```

---

## 🎓 学习资源

### 文档
- [完整部署指南](./DEPLOYMENT_GUIDE.md)
- [API文档](./backend/README.md)
- [前端组件文档](./frontend/README.md)

### 代码示例
- [数据持久化API](./desktop/services/dataStore.js)
- [自动更新服务](./desktop/updater/autoUpdater.js)
- [更新通知组件](./frontend/src/components/UpdateNotification.vue)

---

## 🆘 获取帮助

### GitLab
- 项目地址: https://github.com/YOUR_USERNAME/aegis-arbitrage
- 提交Issue: 项目 → Issues → New Issue
- 查看Wiki: 项目 → Wiki

### CI/CD Pipeline
- 查看构建状态: 项目 → CI/CD → Pipelines
- 查看Runner: 项目 → Settings → CI/CD → Runners
- 查看发布: 项目 → Deployments → Releases

---

## ✅ 检查清单

### 开发环境配置
- [ ] Node.js 20+ 已安装
- [ ] Git 已配置
- [ ] 所有依赖已安装
- [ ] 后端可以启动（端口7700）
- [ ] 前端可以启动（端口5173）
- [ ] 桌面应用可以运行

### GitLab配置
- [ ] 仓库已创建
- [ ] Runner已配置（macOS和Windows）
- [ ] CI/CD环境变量已设置
- [ ] `.gitlab-ci.yml` 已推送

### 首次发布
- [ ] 版本号已更新
- [ ] Git tag已创建
- [ ] 代码已推送到GitLab
- [ ] Pipeline运行成功
- [ ] Release已创建
- [ ] 安装包可下载

### 客户端测试
- [ ] 安装包可以正常安装
- [ ] 应用可以启动
- [ ] 后端服务自动启动
- [ ] 数据可以保存
- [ ] 更新检测正常工作

---

## 🎉 完成！

恭喜！您已成功部署AEGIS套利系统。

### 下一步
1. 配置API密钥
2. 设置套利策略
3. 开始监控市场
4. 发现套利机会
5. 自动或手动执行交易

祝交易愉快！💰
