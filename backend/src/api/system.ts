/**
 * System API Routes
 */

import { Hono } from 'hono';
import type { SystemStatus, ApiResponse } from '../core/types';

export const systemRoutes = new Hono();

// System state
let systemStatus: SystemStatus = {
  isRunning: true,
  mode: 'DRY_RUN',
  uptime: 0,
  lastScan: new Date().toISOString(),
  marketsScanned: 0,
  opportunitiesFound: 0,
  tradesExecuted: 0,
  totalProfit: 0,
  agents: [
    { id: 'semantic-judge', name: '语义法官', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.85 },
    { id: 'irreversibility', name: '不可逆验证器', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.92 },
    { id: 'arbitrage', name: '套利构造器', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.78 },
    { id: 'non-trade', name: '不交易代理', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.65 },
    { id: 'red-team', name: '红队模拟器', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.88 },
    { id: 'fail-safe', name: '故障安全', status: 'ONLINE', lastActivity: new Date().toISOString(), decisionsToday: 0, approvalRate: 0.95 },
  ],
  errors: [],
};

const startTime = Date.now();

// Get system status
systemRoutes.get('/status', async (c) => {
  const start = Date.now();
  
  systemStatus.uptime = Math.floor((Date.now() - startTime) / 1000);
  
  return c.json<ApiResponse<SystemStatus>>({
    success: true,
    data: systemStatus,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Start/Stop system
systemRoutes.post('/control', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ action: 'start' | 'stop' | 'halt' }>();
  
  switch (body.action) {
    case 'start':
      systemStatus.isRunning = true;
      systemStatus.mode = 'DRY_RUN';
      break;
    case 'stop':
      systemStatus.isRunning = false;
      break;
    case 'halt':
      systemStatus.isRunning = false;
      systemStatus.mode = 'HALTED';
      break;
  }
  
  return c.json<ApiResponse<SystemStatus>>({
    success: true,
    data: systemStatus,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Switch mode
systemRoutes.post('/mode', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ mode: 'LIVE' | 'DRY_RUN' }>();
  
  if (body.mode === 'LIVE') {
    // Require additional confirmation for live mode
    const confirm = c.req.header('X-Confirm-Live');
    if (confirm !== 'I_UNDERSTAND_THE_RISKS') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Live mode requires confirmation header: X-Confirm-Live: I_UNDERSTAND_THE_RISKS',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTimeMs: Date.now() - start,
        },
      }, 400);
    }
  }
  
  systemStatus.mode = body.mode;
  
  return c.json<ApiResponse<SystemStatus>>({
    success: true,
    data: systemStatus,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Get system logs
systemRoutes.get('/logs', async (c) => {
  const start = Date.now();
  const level = c.req.query('level');
  const limit = parseInt(c.req.query('limit') || '100');
  
  let logs = systemStatus.errors;
  if (level) {
    logs = logs.filter(e => e.level === level);
  }
  logs = logs.slice(0, limit);
  
  return c.json<ApiResponse<typeof logs>>({
    success: true,
    data: logs,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Emergency halt
systemRoutes.post('/emergency-halt', async (c) => {
  const start = Date.now();
  
  systemStatus.isRunning = false;
  systemStatus.mode = 'HALTED';
  systemStatus.errors.push({
    id: crypto.randomUUID(),
    level: 'CRITICAL',
    message: 'Emergency halt activated by user',
    timestamp: new Date().toISOString(),
  });
  
  return c.json<ApiResponse<{ halted: boolean }>>({
    success: true,
    data: { halted: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Get dashboard stats
systemRoutes.get('/dashboard', async (c) => {
  const start = Date.now();
  
  // 返回真实数据（初始状态为0，随着实际交易增加）
  const stats = {
    capital: systemStatus.totalProfit, // 实际利润累计
    profitToday: 0, // 今日利润（需从数据库计算）
    profitPercent: 0,
    marketsActive: systemStatus.marketsScanned,
    opportunitiesFound: systemStatus.opportunitiesFound,
    agentsOnline: systemStatus.agents.filter(a => a.status === 'ONLINE').length,
    riskLevel: 'LOW',
    lastUpdate: new Date().toISOString(),
  };
  
  return c.json<ApiResponse<typeof stats>>({
    success: true,
    data: stats,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Update stats (internal use)
export function updateStats(data: Partial<SystemStatus>) {
  Object.assign(systemStatus, data);
}
