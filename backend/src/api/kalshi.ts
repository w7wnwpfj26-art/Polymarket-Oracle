/**
 * Kalshi API Routes
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { kalshiService, KalshiMarket, KalshiEvent } from '../services/kalshi';

export const kalshiRoutes = new Hono();

// 获取事件列表
kalshiRoutes.get('/events', async (c) => {
  const start = Date.now();
  const status = c.req.query('status') as 'open' | 'closed' | undefined;
  const category = c.req.query('category');
  const limit = c.req.query('limit');
  
  const events = await kalshiService.getEvents({
    status,
    category: category || undefined,
    limit: limit ? parseInt(limit) : undefined,
  });
  
  return c.json<ApiResponse<KalshiEvent[]>>({
    success: true,
    data: events,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取市场列表
kalshiRoutes.get('/markets', async (c) => {
  const start = Date.now();
  const status = c.req.query('status') as 'open' | 'closed' | undefined;
  const eventTicker = c.req.query('event_ticker');
  const limit = c.req.query('limit');
  const cursor = c.req.query('cursor');
  
  const result = await kalshiService.getMarkets({
    status,
    eventTicker: eventTicker || undefined,
    limit: limit ? parseInt(limit) : undefined,
    cursor: cursor || undefined,
  });
  
  return c.json<ApiResponse<{ markets: KalshiMarket[]; cursor?: string }>>({
    success: true,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取单个市场
kalshiRoutes.get('/markets/:ticker', async (c) => {
  const start = Date.now();
  const ticker = c.req.param('ticker');
  
  const market = await kalshiService.getMarket(ticker);
  
  if (!market) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Market not found' },
      meta: { timestamp: new Date().toISOString() },
    }, 404);
  }
  
  return c.json<ApiResponse<KalshiMarket>>({
    success: true,
    data: market,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取市场历史
kalshiRoutes.get('/markets/:ticker/history', async (c) => {
  const start = Date.now();
  const ticker = c.req.param('ticker');
  const limit = c.req.query('limit');
  
  const history = await kalshiService.getMarketHistory(ticker, {
    limit: limit ? parseInt(limit) : undefined,
  });
  
  return c.json<ApiResponse<typeof history>>({
    success: true,
    data: history,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取订单簿
kalshiRoutes.get('/markets/:ticker/orderbook', async (c) => {
  const start = Date.now();
  const ticker = c.req.param('ticker');
  
  const orderbook = await kalshiService.getOrderbook(ticker);
  
  if (!orderbook) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Orderbook not found' },
      meta: { timestamp: new Date().toISOString() },
    }, 404);
  }
  
  return c.json<ApiResponse<typeof orderbook>>({
    success: true,
    data: orderbook,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 配置 Kalshi
kalshiRoutes.post('/configure', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    email?: string;
    password?: string;
    token?: string;
  }>();
  
  kalshiService.configure(body);
  
  return c.json<ApiResponse<{ configured: boolean }>>({
    success: true,
    data: { configured: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 登录
kalshiRoutes.post('/login', async (c) => {
  const start = Date.now();
  
  const success = await kalshiService.login();
  
  return c.json<ApiResponse<{ loggedIn: boolean }>>({
    success,
    data: { loggedIn: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
