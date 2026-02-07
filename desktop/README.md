# AEGIS 桌面客户端

跨平台桌面应用程序，为用户提供完整的AEGIS套利系统体验。

## 🚀 特性

- **跨平台支持**：Windows 和 macOS 原生应用
- **自动更新**：基于Git Release的无缝版本升级
- **本地后端**：内置Node.js服务，无需额外安装
- **系统集成**：托盘图标、开机自启、系统通知
- **离线可用**：网络断开时仍可查看历史数据

## 📦 安装方式

### 从GitHub Release下载
1. 访问 [Releases页面](https://github.com/your-username/aegis-arbitrage/releases)
2. 下载对应平台的安装包：
   - Windows: `.exe` 或 `.zip`
   - macOS: `.dmg` 或 `.zip`

### 开发者构建
```bash
# 克隆仓库
git clone https://github.com/your-username/aegis-arbitrage.git
cd aegis-arbitrage

# 安装依赖
npm install

# 开发模式运行
npm run dev:desktop

# 构建生产版本
npm run build:desktop
```

## 🛠️ 开发指南

### 项目结构
```
desktop/
├── electron/           # Electron主进程代码
│   ├── main.js        # 主进程入口
│   └── preload.js     # 预加载脚本
├── updater/           # 自动更新模块
│   └── autoUpdater.js # 更新服务
├── assets/            # 应用资源文件
└── package.json       # 桌面应用配置
```

### 构建命令
```bash
# 构建所有平台
npm run build:desktop

# 仅构建Windows
npm run build:win

# 仅构建macOS
npm run build:mac
```

### 发布新版本
```bash
# 小版本更新 (1.0.0 → 1.0.1)
npm run release:patch

# 中版本更新 (1.0.0 → 1.1.0)
npm run release:minor

# 大版本更新 (1.0.0 → 2.0.0)
npm run release:major
```

## 🔧 技术架构

### 核心组件
- **Electron**: 跨平台桌面应用框架
- **electron-builder**: 应用打包和分发
- **electron-updater**: 自动更新机制
- **Vue 3**: 前端用户界面
- **Hono**: 后端API服务

### 自动更新流程
1. 应用启动时检查GitHub Releases
2. 发现新版本时提示用户下载
3. 后台下载更新包
4. 下载完成后提示重启安装

### 后端服务管理
- 应用启动时自动启动本地Node.js服务
- 服务崩溃时自动重启
- 提供系统托盘控制选项

## 🔒 安全特性

- **代码签名**：所有发布版本都经过数字签名
- **HTTPS传输**：更新包通过安全连接下载
- **完整性校验**：SHA256校验确保文件未被篡改
- **沙箱隔离**：渲染进程与主进程安全隔离

## 🎯 使用场景

### 日常交易
- 开机自启，始终保持在线
- 系统托盘快速访问
- 实时推送重要通知

### 离线工作
- 查看历史交易记录
- 分析过往套利机会
- 配置交易策略

### 团队协作
- 多用户配置管理
- 交易日志同步
- 策略分享机制

## 🐛 故障排除

### 常见问题

**Q: 应用无法启动**
A: 检查系统是否满足最低要求，查看日志文件获取详细错误信息

**Q: 后端服务无法连接**
A: 尝试通过系统托盘菜单重启后端服务

**Q: 更新失败**
A: 检查网络连接，或手动从GitHub下载最新版本

### 日志位置
- Windows: `%APPDATA%\aegis-arbitrage\logs`
- macOS: `~/Library/Logs/aegis-arbitrage`

## 📱 系统要求

### Windows
- Windows 10 或更高版本
- x64 架构
- 至少 2GB RAM

### macOS
- macOS 10.15 或更高版本
- Intel 或 Apple Silicon
- 至少 2GB RAM

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件