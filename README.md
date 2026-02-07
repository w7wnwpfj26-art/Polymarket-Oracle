# AEGIS Arbitrage System v2.0

> 2026 最新技术栈构建的多代理套利系统

## 🚀 技术栈

### 后端 (Backend)
- **Runtime**: Node.js 22 / Bun
- **Framework**: Hono (轻量级、高性能 Web 框架)
- **Language**: TypeScript 5.6+
- **Database**: SQLite + Drizzle ORM
- **WebSocket**: ws (实时数据推送)
- **Logging**: Pino (结构化日志)
- **AI**: OpenAI / Anthropic Claude / DeepSeek

### 前端 (Frontend)
- **Framework**: Vue 3.5 (Composition API + Script Setup)
- **Build Tool**: Vite 6.0
- **Styling**: Tailwind CSS 4.0
- **State**: Pinia
- **Charts**: Chart.js + vue-chartjs
- **Utilities**: VueUse

## 📁 项目结构

```
new/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── api/            # API 路由
│   │   │   ├── markets.ts
│   │   │   ├── arbitrage.ts
│   │   │   ├── agents.ts
│   │   │   ├── system.ts
│   │   │   ├── config.ts
│   │   │   ├── stats.ts
│   │   │   └── openapi.ts  # Swagger 文档
│   │   ├── agents/         # AI 代理
│   │   │   ├── semanticJudge.ts
│   │   │   ├── irreversibilityVerifier.ts
│   │   │   ├── arbitrageAgent.ts
│   │   │   ├── nonTradeAgent.ts
│   │   │   ├── redTeamSimulator.ts
│   │   │   └── failSafeMonitor.ts
│   │   ├── db/             # 数据库
│   │   │   ├── schema.ts   # Drizzle 模式
│   │   │   ├── index.ts    # 连接初始化
│   │   │   └── repository.ts # CRUD 操作
│   │   ├── services/       # 业务服务
│   │   │   ├── ai.ts       # AI 集成
│   │   │   ├── wallet.ts   # 钱包服务
│   │   │   ├── notification.ts # 通知服务
│   │   │   ├── websocket.ts # WebSocket
│   │   │   ├── polymarket.ts
│   │   │   └── oddsApi.ts
│   │   ├── utils/
│   │   │   └── logger.ts   # Pino 日志
│   │   └── core/
│   │       └── types.ts
│   ├── tests/              # 单元测试
│   └── package.json
│
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # Vue 组件
│   │   │   ├── layout/
│   │   │   └── charts/
│   │   ├── views/          # 页面视图
│   │   ├── stores/         # Pinia 状态
│   │   ├── composables/    # 组合式函数
│   │   └── styles/         # CSS 样式
│   └── package.json
│
├── docker-compose.yml      # Docker 编排
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── README.md
```

## 🛠️ 快速开始

### 方式 1：使用 Node.js (推荐)

```bash
# 后端
cd new/backend
npm install
npm run dev

# 前端 (新终端)
cd new/frontend
npm install
npm run dev
```

### 方式 2：使用 Bun

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 后端
cd new/backend
bun install
bun run dev:bun

# 前端
cd new/frontend
bun install
bun run dev
```

### 方式 3：Docker 部署

```bash
cd new

# 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入 API Keys

# 启动服务
docker-compose up -d
```

### 访问应用

- 前端: http://localhost:5173 (开发) / http://localhost (Docker)
- 后端 API: http://localhost:7700
- WebSocket: ws://localhost:7701
- API 文档: http://localhost:7700/api/docs

## 📡 API 端点

### 系统状态
- `GET /health` - 健康检查
- `GET /api/system/status` - 获取系统状态
- `GET /api/system/dashboard` - 获取仪表板数据
- `POST /api/system/scan` - 扫描市场
- `POST /api/system/emergency-halt` - 紧急停止

### 市场
- `GET /api/markets` - 获取市场列表
- `GET /api/markets/:id` - 获取单个市场
- `POST /api/markets/scan` - 扫描市场

### 套利
- `GET /api/arbitrage/opportunities` - 获取套利机会
- `POST /api/arbitrage/scan` - 扫描套利机会
- `POST /api/arbitrage/analyze/:id` - 分析机会
- `POST /api/arbitrage/execute/:id` - 执行套利
- `GET /api/arbitrage/history` - 执行历史

### AI 代理
- `GET /api/agents` - 获取所有代理
- `POST /api/agents/:id/toggle` - 启用/禁用代理
- `POST /api/agents/:id/test` - 测试代理

### 配置
- `GET /api/config` - 获取配置
- `PUT /api/config` - 更新配置
- `PATCH /api/config/:section` - 更新配置节
- `POST /api/config/reset` - 重置配置

### 统计
- `GET /api/stats/daily` - 每日统计
- `GET /api/stats/summary` - 汇总统计
- `GET /api/stats/logs` - 系统日志
- `GET /api/stats/database` - 数据库统计

### 文档
- `GET /api/docs` - Swagger UI
- `GET /api/docs/openapi.json` - OpenAPI 规范

## 🤖 AI 代理

| 代理 | 功能 | AI 支持 |
|------|------|---------|
| 语义法官 | 分析市场描述的语义风险 | ✅ OpenAI/Claude |
| 不可逆验证器 | 验证事件是否已不可逆 | ✅ OpenAI/Claude |
| 套利构造器 | 构建和验证套利策略 | 规则引擎 |
| 不交易代理 | 决定何时不应该交易 | ✅ OpenAI/Claude |
| 红队模拟器 | 对抗性攻击模拟 | ✅ OpenAI/Claude |
| 故障安全 | 异常检测和紧急停止 | 规则引擎 |

## 🔔 通知系统

支持以下通知渠道：

- **Telegram**: 配置 Bot Token 和 Chat ID
- **Discord**: 配置 Webhook URL
- **自定义 Webhook**: 任意 HTTP 端点

通知事件：
- 发现套利机会
- 交易执行状态
- 系统错误
- 每日报告

## 🗄️ 数据持久化

使用 SQLite + Drizzle ORM：

- `markets` - 市场数据
- `opportunities` - 套利机会
- `execution_plans` - 执行计划
- `trades` - 交易记录
- `agent_decisions` - 代理决策
- `system_logs` - 系统日志
- `daily_stats` - 每日统计

## ⚙️ 配置说明

在配置页面或通过 API 配置：

### AI 配置
- Provider: openai / anthropic / deepseek / local
- Model: gpt-4-turbo / claude-3-opus / deepseek-chat
- API Key: 对应提供商的 API Key
- Temperature: 0-2

### 风险管理
- 最大语义风险: 0-100
- 最小不可逆评分: 0-100
- 单笔最大金额: $
- 总敞口上限: $
- 每日最大亏损: $
- 需要一致同意: 是/否

### 数据源
- Polymarket: 钱包地址、API 凭证
- The Odds API: API Key

### 通知
- Telegram: Bot Token, Chat ID
- Discord: Webhook URL

## 🔐 安全原则

1. **任何代理有疑虑，系统不交易**
2. **资本保全优先于收益最大化**
3. **模拟模式默认开启**
4. **需要一致同意才能执行**
5. **敏感信息脱敏展示**

## 🧪 测试

```bash
cd new/backend
npm run test
```

## 📜 License

MIT

---

Built with ❤️ using Hono + Vue 3 + Tailwind CSS 4 + SQLite + Pino
