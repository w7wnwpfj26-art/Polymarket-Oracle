/**
 * 跨平台对冲机会 API
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse } from '../core/types';
import { hedgeDetector, MarketData, HedgeOpportunity } from '../services/hedgeDetector';
import { bettingSiteRepository } from '../db/bettingSiteRepository';
import logger from '../utils/logger';
import { hedgeMarketDataSchema, hedgeScanSchema, hedgeCalculateSchema } from './schemas';

export const hedgeRoutes = new Hono();

// 获取对冲检测状态
hedgeRoutes.get('/status', async (c) => {
  const start = Date.now();
  const status = hedgeDetector.getStatus();
  
  return c.json<ApiResponse<typeof status>>({
    success: true,
    data: status,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 更新 Polymarket 市场数据
hedgeRoutes.post('/polymarket/sync', async (c) => {
  const start = Date.now();
  
  try {
    // 从 Polymarket API 获取数据
    const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=100');
    const data = await response.json();
    
    const markets: MarketData[] = data.map((m: any) => ({
      source: 'polymarket' as const,
      platform: 'Polymarket',
      eventName: m.question,
      question: m.question,
      outcomes: [
        { name: 'Yes', price: m.outcomePrices?.[0] || 0.5, impliedProbability: (m.outcomePrices?.[0] || 0.5) * 100 },
        { name: 'No', price: m.outcomePrices?.[1] || 0.5, impliedProbability: (m.outcomePrices?.[1] || 0.5) * 100 },
      ],
      timestamp: new Date(),
      metadata: {
        id: m.id,
        slug: m.slug,
        volume: m.volume,
        liquidity: m.liquidity,
      },
    }));
    
    hedgeDetector.updatePolymarketData(markets);
    
    return c.json<ApiResponse<{ synced: number }>>({
      success: true,
      data: { synced: markets.length },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    logger.system.error('Polymarket sync failed', { error: (error as Error).message });
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'SYNC_FAILED', message: (error as Error).message },
      meta: { timestamp: new Date().toISOString() },
    }, 500);
  }
});

// 更新传统平台数据（从赔率历史）
hedgeRoutes.post('/traditional/:platform/sync', async (c) => {
  const start = Date.now();
  const platform = c.req.param('platform');
  
  try {
    await hedgeDetector.loadTraditionalFromHistory(platform);
    
    const status = hedgeDetector.getStatus();
    const platformData = status.traditionalPlatforms.find(p => p.name === platform);
    
    return c.json<ApiResponse<{ synced: number }>>({
      success: true,
      data: { synced: platformData?.count || 0 },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    logger.system.error('Traditional sync failed', { platform, error: (error as Error).message });
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'SYNC_FAILED', message: (error as Error).message },
      meta: { timestamp: new Date().toISOString() },
    }, 500);
  }
});

// 手动添加传统平台市场数据
hedgeRoutes.post('/traditional/:platform/markets', async (c) => {
  const start = Date.now();
  const platform = c.req.param('platform');
  
  let body: z.infer<typeof hedgeMarketDataSchema>;
  try {
    body = hedgeMarketDataSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  hedgeDetector.updateTraditionalData(platform, body.markets as MarketData[]);
  
  return c.json<ApiResponse<{ added: number }>>({
    success: true,
    data: { added: body.markets.length },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 扫描对冲机会
hedgeRoutes.post('/scan', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    minProfit?: number;
    maxRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    useAI?: boolean;
  }>().catch(() => ({}));
  
  try {
    const opportunities = await hedgeDetector.scanOpportunities(body);
    
    return c.json<ApiResponse<{ found: number; opportunities: HedgeOpportunity[] }>>({
      success: true,
      data: { found: opportunities.length, opportunities },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    logger.system.error('Hedge scan failed', { error: (error as Error).message });
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'SCAN_FAILED', message: (error as Error).message },
      meta: { timestamp: new Date().toISOString() },
    }, 500);
  }
});

// 获取当前对冲机会列表
hedgeRoutes.get('/opportunities', async (c) => {
  const start = Date.now();
  const opportunities = hedgeDetector.getOpportunities();
  
  return c.json<ApiResponse<HedgeOpportunity[]>>({
    success: true,
    data: opportunities,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取特定对冲机会详情
hedgeRoutes.get('/opportunities/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const opportunity = hedgeDetector.getOpportunity(id);
  
  if (!opportunity) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Opportunity not found' },
      meta: { timestamp: new Date().toISOString() },
    }, 404);
  }
  
  return c.json<ApiResponse<HedgeOpportunity>>({
    success: true,
    data: opportunity,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 模拟对冲计算
hedgeRoutes.post('/calculate', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof hedgeCalculateSchema>;
  try {
    body = hedgeCalculateSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  const { polymarketPrice, traditionalOdds, investment, polySide } = body;
  
  // 计算对冲分配
  const polyImpliedProb = polymarketPrice;
  const tradImpliedProb = 1 / traditionalOdds;
  const totalImpliedProb = polyImpliedProb + tradImpliedProb;
  
  if (totalImpliedProb >= 1) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        hasArbitrage: false,
        message: '无套利机会：两边隐含概率之和 >= 100%',
        polyImpliedProb: (polyImpliedProb * 100).toFixed(2) + '%',
        tradImpliedProb: (tradImpliedProb * 100).toFixed(2) + '%',
        totalImpliedProb: (totalImpliedProb * 100).toFixed(2) + '%',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  }
  
  // 按比例分配
  const polyRatio = tradImpliedProb / totalImpliedProb;
  const tradRatio = 1 - polyRatio;
  
  const polyStake = investment * polyRatio;
  const tradStake = investment * tradRatio;
  
  // 计算回报
  const polyWinReturn = polyStake / polymarketPrice;
  const tradWinReturn = tradStake * traditionalOdds;
  
  const minReturn = Math.min(polyWinReturn, tradWinReturn);
  const profit = minReturn - investment;
  const profitPercent = (profit / investment) * 100;
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      hasArbitrage: profit > 0,
      investment,
      allocation: {
        polymarket: {
          side: polySide,
          stake: Math.round(polyStake * 100) / 100,
          price: polymarketPrice,
          potentialReturn: Math.round(polyWinReturn * 100) / 100,
        },
        traditional: {
          stake: Math.round(tradStake * 100) / 100,
          odds: traditionalOdds,
          potentialReturn: Math.round(tradWinReturn * 100) / 100,
        },
      },
      outcomes: {
        ifPolymarketWins: {
          return: Math.round(polyWinReturn * 100) / 100,
          profit: Math.round((polyWinReturn - investment) * 100) / 100,
        },
        ifTraditionalWins: {
          return: Math.round(tradWinReturn * 100) / 100,
          profit: Math.round((tradWinReturn - investment) * 100) / 100,
        },
      },
      guaranteed: {
        minReturn: Math.round(minReturn * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        profitPercent: Math.round(profitPercent * 100) / 100,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
