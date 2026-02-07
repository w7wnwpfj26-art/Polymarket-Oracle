/**
 * OpenAPI Documentation
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';

export const docsRoutes = new Hono();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AEGIS Arbitrage System API',
    description: `
# AEGIS 套利系统 API

多代理自动化套利系统 API 文档。

## 功能模块

- **市场监控** - 获取 Polymarket 和传统博彩市场数据
- **套利检测** - 发现 Dutch Book 和跨平台套利机会
- **AI 代理** - 语义分析、风险评估、对抗性模拟
- **交易执行** - 自动化交易执行和监控
- **实时数据** - WebSocket 推送

## 认证

目前 API 不需要认证。生产环境建议添加 API Key 认证。

## 速率限制

- 默认: 100 请求/分钟
- WebSocket: 无限制
    `,
    version: '2.0.0',
    contact: {
      name: 'AEGIS Team',
      email: 'support@aegis.example.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:7700',
      description: '本地开发服务器',
    },
    {
      url: 'https://api.aegis.example.com',
      description: '生产服务器',
    },
  ],
  tags: [
    { name: '系统', description: '系统状态和健康检查' },
    { name: '市场', description: '市场数据获取和监控' },
    { name: '套利', description: '套利机会检测和分析' },
    { name: 'AI代理', description: 'AI 代理管理和测试' },
    { name: '配置', description: '系统配置管理' },
    { name: '统计', description: '统计数据和日志' },
  ],
  paths: {
    '/': {
      get: {
        tags: ['系统'],
        summary: 'API 根节点',
        description: '返回 API 基本信息',
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiInfo',
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['系统'],
        summary: '健康检查',
        description: '检查系统健康状态',
        responses: {
          200: {
            description: '系统健康',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthCheck',
                },
              },
            },
          },
        },
      },
    },
    '/api/system/status': {
      get: {
        tags: ['系统'],
        summary: '系统状态',
        description: '获取详细系统状态，包括代理状态、资金信息等',
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SystemStatus',
                },
              },
            },
          },
        },
      },
    },
    '/api/markets': {
      get: {
        tags: ['市场'],
        summary: '获取市场列表',
        description: '获取所有监控中的市场数据',
        parameters: [
          {
            name: 'source',
            in: 'query',
            description: '数据源筛选',
            schema: {
              type: 'string',
              enum: ['polymarket', 'odds_api'],
            },
          },
          {
            name: 'page',
            in: 'query',
            description: '页码',
            schema: {
              type: 'integer',
              default: 1,
            },
          },
          {
            name: 'pageSize',
            in: 'query',
            description: '每页数量',
            schema: {
              type: 'integer',
              default: 20,
            },
          },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MarketList',
                },
              },
            },
          },
        },
      },
    },
    '/api/markets/scan': {
      post: {
        tags: ['市场'],
        summary: '扫描市场',
        description: '主动扫描并刷新市场数据',
        responses: {
          200: {
            description: '扫描完成',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ScanResult',
                },
              },
            },
          },
        },
      },
    },
    '/api/arbitrage/opportunities': {
      get: {
        tags: ['套利'],
        summary: '获取套利机会',
        description: '获取当前检测到的套利机会列表',
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OpportunityList',
                },
              },
            },
          },
        },
      },
    },
    '/api/arbitrage/scan': {
      post: {
        tags: ['套利'],
        summary: '扫描套利机会',
        description: '执行完整的套利机会扫描流程',
        responses: {
          200: {
            description: '扫描完成',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ArbitrageScanResult',
                },
              },
            },
          },
        },
      },
    },
    '/api/arbitrage/analyze/{id}': {
      post: {
        tags: ['套利'],
        summary: '分析套利机会',
        description: '使用所有 AI 代理分析指定的套利机会',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '套利机会 ID',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          200: {
            description: '分析完成',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExecutionPlan',
                },
              },
            },
          },
        },
      },
    },
    '/api/agents': {
      get: {
        tags: ['AI代理'],
        summary: '获取代理列表',
        description: '获取所有 AI 代理的状态',
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AgentList',
                },
              },
            },
          },
        },
      },
    },
    '/api/agents/{id}/test': {
      post: {
        tags: ['AI代理'],
        summary: '测试代理',
        description: '使用测试数据运行指定代理',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '代理 ID',
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AgentTestInput',
              },
            },
          },
        },
        responses: {
          200: {
            description: '测试完成',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AgentResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/config': {
      get: {
        tags: ['配置'],
        summary: '获取配置',
        description: '获取当前系统配置（敏感信息已脱敏）',
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SystemConfig',
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['配置'],
        summary: '更新配置',
        description: '更新系统配置',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SystemConfig',
              },
            },
          },
        },
        responses: {
          200: {
            description: '更新成功',
          },
        },
      },
    },
    '/api/stats/daily': {
      get: {
        tags: ['统计'],
        summary: '获取每日统计',
        description: '获取指定天数的每日统计数据',
        parameters: [
          {
            name: 'days',
            in: 'query',
            description: '天数',
            schema: {
              type: 'integer',
              default: 30,
            },
          },
        ],
        responses: {
          200: {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DailyStats',
                },
              },
            },
          },
        },
      },
    },
    '/api/stats/logs': {
      get: {
        tags: ['统计'],
        summary: '获取系统日志',
        description: '获取系统日志',
        parameters: [
          {
            name: 'level',
            in: 'query',
            description: '日志级别',
            schema: {
              type: 'string',
              enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
            },
          },
          {
            name: 'category',
            in: 'query',
            description: '日志分类',
            schema: {
              type: 'string',
              enum: ['system', 'agent', 'trade', 'api'],
            },
          },
          {
            name: 'limit',
            in: 'query',
            description: '返回数量',
            schema: {
              type: 'integer',
              default: 100,
            },
          },
        ],
        responses: {
          200: {
            description: '成功',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiInfo: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'AEGIS Arbitrage System' },
          version: { type: 'string', example: '2.0.0' },
          status: { type: 'string', example: 'operational' },
        },
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number', example: 3600 },
        },
      },
      SystemStatus: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['LIVE', 'SIMULATION'] },
          totalCapital: { type: 'number' },
          todayProfit: { type: 'number' },
          activePositions: { type: 'integer' },
          agents: { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
        },
      },
      Market: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string', enum: ['polymarket', 'odds_api'] },
          outcomes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
              },
            },
          },
          volume24h: { type: 'number' },
          liquidity: { type: 'number' },
        },
      },
      MarketList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Market' } },
          total: { type: 'integer' },
        },
      },
      Agent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['ONLINE', 'OFFLINE'] },
          decisionsToday: { type: 'integer' },
          approvalRate: { type: 'number' },
        },
      },
      AgentResponse: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          agentName: { type: 'string' },
          decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'ABSTAIN'] },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          reasoning: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
      AgentList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
        },
      },
      AgentTestInput: {
        type: 'object',
        properties: {
          marketQuestion: { type: 'string' },
          marketDescription: { type: 'string' },
        },
      },
      ArbitrageOpportunity: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['DUTCH_BOOK', 'CROSS_PLATFORM', 'HEDGE_ARB'] },
          expectedProfit: { type: 'number' },
          expectedProfitPercent: { type: 'number' },
          worstCaseLoss: { type: 'number' },
          confidence: { type: 'integer' },
        },
      },
      OpportunityList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/ArbitrageOpportunity' } },
        },
      },
      ExecutionPlan: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          finalDecision: { type: 'string', enum: ['EXECUTE', 'HOLD', 'HALT'] },
          unanimousApproval: { type: 'boolean' },
          agentResponses: { type: 'array', items: { $ref: '#/components/schemas/AgentResponse' } },
        },
      },
      SystemConfig: {
        type: 'object',
        properties: {
          ai: { type: 'object' },
          strategy: { type: 'object' },
          agents: { type: 'object' },
          dataSources: { type: 'object' },
          notifications: { type: 'object' },
        },
      },
      ScanResult: {
        type: 'object',
        properties: {
          marketsScanned: { type: 'integer' },
          newMarkets: { type: 'integer' },
          updatedMarkets: { type: 'integer' },
        },
      },
      ArbitrageScanResult: {
        type: 'object',
        properties: {
          marketsAnalyzed: { type: 'integer' },
          opportunitiesFound: { type: 'integer' },
          opportunities: { type: 'array', items: { $ref: '#/components/schemas/ArbitrageOpportunity' } },
        },
      },
      DailyStats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            netProfit: { type: 'number' },
            opportunitiesFound: { type: 'integer' },
            opportunitiesExecuted: { type: 'integer' },
          },
        },
      },
    },
  },
};

// Serve OpenAPI JSON
docsRoutes.get('/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// Serve Swagger UI HTML
docsRoutes.get('/', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEGIS API 文档</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; background: #1a1a2e; }
    .swagger-ui { background: #1a1a2e; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #00ff88; }
    .swagger-ui .info .description { color: #fff; }
    .swagger-ui .opblock-tag { color: #00bfff; }
    .swagger-ui .opblock .opblock-summary-operation-id { color: #fff; }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #00ff88; }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #00bfff; }
    .swagger-ui .opblock.opblock-put .opblock-summary { border-color: #ffaa00; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: #ff4444; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: -1,
      });
    };
  </script>
</body>
</html>
  `;
  return c.html(html);
});
