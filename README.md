# 🔮 Polymarket-Oracle

<div align="center">

**AI-Powered Prediction Market Arbitrage System**

*Multi-agent architecture for cross-platform trading*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.0-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[English](#-features) | [中文](#-快速开始)

<img src="https://raw.githubusercontent.com/polymarket/public-assets/main/pm_logo.svg" alt="Polymarket" height="40"/>

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 6 AI Agents
- **Semantic Judge** - Analyzes market description risks
- **Irreversibility Verifier** - Confirms event finality
- **Arbitrage Constructor** - Builds trading strategies
- **Non-Trade Agent** - Decides when NOT to trade
- **Red Team Simulator** - Adversarial attack testing
- **Fail-Safe Monitor** - Real-time anomaly detection

</td>
<td width="50%">

### 📊 Multi-Platform
- **Polymarket** - Crypto prediction markets
- **Kalshi** - CFTC-regulated exchange
- **Traditional Sportsbooks** - Via Odds API
- **Dutch Book Detection** - Cross-market arbitrage
- **Real-time WebSocket** - Live data streaming

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vue 3)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Dashboard │  │ Markets  │  │ Arbitrage│  │   AI Agents      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
        └─────────────┴──────┬──────┴─────────────────┘
                             │ WebSocket + REST API
┌────────────────────────────┼────────────────────────────────────┐
│                    Backend (Hono)                               │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                    API Gateway                            │  │
│  │  • Rate Limiting  • Security Headers  • Error Handling    │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  AI Agents    │  │  Arbitrage    │  │  Data Sources │       │
│  │  ──────────── │  │  ──────────── │  │  ──────────── │       │
│  │  • Semantic   │  │  • Scanner    │  │  • Polymarket │       │
│  │  • Verifier   │  │  • Executor   │  │  • Kalshi     │       │
│  │  • Red Team   │  │  • Validator  │  │  • Odds API   │       │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘       │
│          └──────────────────┼──────────────────┘                │
│                             ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │        Multi-Level Cache (L1 Memory + L2 Redis)          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SQLite + Drizzle ORM                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 方式一：一键启动 (推荐)

```bash
# 克隆仓库
git clone https://github.com/w7wnwpfj26-art/Polymarket-Oracle.git
cd Polymarket-Oracle

# 配置环境
cp .env.example .env
cp backend/data/config.json.example backend/data/config.json

# 启动服务
./start.sh
```

访问 **http://localhost:5173** 即可使用！

### 方式二：手动启动

```bash
# 后端
cd backend && npm install && npm run dev

# 前端 (新终端)
cd frontend && npm install && npm run dev
```

### 方式三：Docker

```bash
docker-compose up -d
```

---

## 🔑 API Keys 配置

编辑 `.env` 文件：

```env
# AI Provider (选一个)
OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-xxx
# DEEPSEEK_API_KEY=sk-xxx

# Data Sources
ODDS_API_KEY=xxx

# Notifications (可选)
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
```

> 📖 详细配置说明: [API_KEYS_SETUP.md](API_KEYS_SETUP.md)

---

## 🤖 AI 代理系统

| Agent | 功能 | 否决权 |
|-------|------|--------|
| 🧠 **Semantic Judge** | 分析市场描述，识别语义陷阱和歧义 | ✅ |
| 🔒 **Irreversibility Verifier** | 验证事件是否已不可逆转 | ✅ |
| 📐 **Arbitrage Constructor** | 构建最优套利策略 | ✅ |
| 🚫 **Non-Trade Agent** | 识别不应交易的情况 | ✅ |
| ⚔️ **Red Team Simulator** | 模拟对抗性攻击场景 | ✅ |
| 🛡️ **Fail-Safe Monitor** | 实时监控异常，紧急熔断 | ✅ |

**核心原则**: 任何代理有疑虑 → 系统不交易

---

## 📡 API 文档

### 核心端点

| 方法 | 端点 | 描述 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/markets` | 获取市场列表 |
| `GET` | `/api/arbitrage/opportunities` | 获取套利机会 |
| `POST` | `/api/arbitrage/execute/:id` | 执行套利 |
| `GET` | `/api/agents` | 获取代理状态 |
| `GET` | `/api/system-status/dashboard` | 系统仪表板 |

> 📖 完整API文档: http://localhost:7700/api/docs

---

## 🛡️ 安全特性

- ✅ **全局错误处理** - 统一错误响应，请求ID追踪
- ✅ **安全头部** - CSP, HSTS, XSS Protection
- ✅ **速率限制** - IP级别限流防护
- ✅ **输入验证** - Zod Schema 全覆盖
- ✅ **敏感信息保护** - 生产环境堆栈脱敏

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| API 延迟 (P95) | **< 100ms** |
| 缓存命中率 | **95%+** |
| WebSocket 稳定性 | **98%+** |
| 响应压缩率 | **70%+** |

---

## 🗂️ 项目结构

```
Polymarket-Oracle/
├── backend/                 # Hono + TypeScript
│   ├── src/
│   │   ├── agents/         # 6个AI代理
│   │   ├── api/            # REST API路由
│   │   ├── db/             # SQLite + Drizzle
│   │   ├── middleware/     # 安全、缓存、错误处理
│   │   └── services/       # 业务逻辑
│   └── data/               # 数据库文件
├── frontend/               # Vue 3 + Vite
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── components/     # UI组件
│   │   └── composables/    # 组合式函数
├── docker-compose.yml      # Docker编排
└── start.sh               # 一键启动脚本
```

---

## 🤝 贡献指南

欢迎贡献代码！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
# Fork 仓库后
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
# 创建 Pull Request
```

---

## ⚠️ 免责声明

**本软件仅供教育和研究目的。**

- 交易涉及财务风险，使用需自担风险
- 过往表现不代表未来收益
- 请确保使用符合当地法律法规
- 切勿提交真实的 API 密钥或私钥

---

## 📜 License

[MIT License](LICENSE) © 2024

---

<div align="center">

**Built with ❤️ by the community**

[⭐ Star](https://github.com/w7wnwpfj26-art/Polymarket-Oracle) · [🐛 Issues](https://github.com/w7wnwpfj26-art/Polymarket-Oracle/issues) · [💬 Discussions](https://github.com/w7wnwpfj26-art/Polymarket-Oracle/discussions)

</div>
