/**
 * 跟单交易 API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse } from '../core/types';
import { copyTradingService, Trader, CopyPosition, CopyTrade } from '../services/copyTrading';
import { traderRegisterSchema, startCopySchema } from './schemas';

export const copyTradingRoutes = new Hono();

// ============ 交易员 ============

// 获取交易员列表
copyTradingRoutes.get('/traders', async (c) => {
  const start = Date.now();
  const sortBy = c.req.query('sortBy') as 'profitPercent' | 'winRate' | 'followers' | 'sharpeRatio' | undefined;
  const verified = c.req.query('verified');
  const limit = c.req.query('limit');
  
  const traders = copyTradingService.getTraders({
    sortBy,
    verified: verified ? verified === 'true' : undefined,
    limit: limit ? parseInt(limit) : undefined,
  });
  
  return c.json<ApiResponse<Trader[]>>({
    success: true,
    data: traders,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取单个交易员
copyTradingRoutes.get('/traders/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  const trader = copyTradingService.getTrader(id);
  
  if (!trader) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Trader not found' },
      meta: { timestamp: new Date().toISOString() },
    }, 404);
  }
  
  return c.json<ApiResponse<Trader>>({
    success: true,
    data: trader,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 注册成为交易员
copyTradingRoutes.post('/traders/register', async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  let body: z.infer<typeof traderRegisterSchema>;
  try {
    body = traderRegisterSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  const trader = copyTradingService.registerAsTrader(user?.sub || 'anonymous', body);
  
  return c.json<ApiResponse<Trader>>({
    success: true,
    data: trader,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取排行榜
copyTradingRoutes.get('/leaderboard', async (c) => {
  const start = Date.now();
  const period = c.req.query('period') as '7d' | '30d' | 'all' | undefined;
  
  const leaderboard = copyTradingService.getLeaderboard(period || '30d');
  
  return c.json<ApiResponse<Trader[]>>({
    success: true,
    data: leaderboard,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 跟单仓位 ============

// 开始跟单
copyTradingRoutes.post('/positions', async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  let body: z.infer<typeof startCopySchema>;
  try {
    body = startCopySchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  const position = copyTradingService.startCopying(
    user?.sub || 'anonymous',
    body.traderId,
    body.amount
  );
  
  if (!position) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'COPY_FAILED', message: 'Failed to start copying' },
      meta: { timestamp: new Date().toISOString() },
    }, 400);
  }
  
  return c.json<ApiResponse<CopyPosition>>({
    success: true,
    data: position,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取我的跟单仓位
copyTradingRoutes.get('/positions', async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  const positions = copyTradingService.getPositions(user?.sub || 'anonymous');
  
  return c.json<ApiResponse<CopyPosition[]>>({
    success: true,
    data: positions,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 停止跟单
copyTradingRoutes.delete('/positions/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  const success = copyTradingService.stopCopying(id);
  
  return c.json<ApiResponse<{ stopped: boolean }>>({
    success,
    data: { stopped: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 暂停/恢复跟单
copyTradingRoutes.post('/positions/:id/toggle', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  const success = copyTradingService.pauseCopying(id);
  
  return c.json<ApiResponse<{ toggled: boolean }>>({
    success,
    data: { toggled: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 交易历史 ============

// 获取交易历史
copyTradingRoutes.get('/trades', async (c) => {
  const start = Date.now();
  const user = c.get('user');
  const traderId = c.req.query('traderId');
  const positionId = c.req.query('positionId');
  const limit = c.req.query('limit');
  
  const trades = copyTradingService.getTradeHistory({
    followerId: user?.sub,
    traderId: traderId || undefined,
    positionId: positionId || undefined,
    limit: limit ? parseInt(limit) : undefined,
  });
  
  return c.json<ApiResponse<CopyTrade[]>>({
    success: true,
    data: trades,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// ============ 统计 ============

// 获取跟单统计
copyTradingRoutes.get('/stats', async (c) => {
  const start = Date.now();
  const user = c.get('user');
  
  const stats = copyTradingService.getCopyStats(user?.sub || 'anonymous');
  
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

// 获取交易员的跟随者
copyTradingRoutes.get('/traders/:id/followers', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  const followers = copyTradingService.getFollowers(id);
  
  return c.json<ApiResponse<CopyPosition[]>>({
    success: true,
    data: followers,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
