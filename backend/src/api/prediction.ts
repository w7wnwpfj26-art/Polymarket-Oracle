/**
 * 价格预测 API Routes
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { pricePredictor, PricePrediction } from '../services/pricePredictor';

export const predictionRoutes = new Hono();

// 预测单个市场
predictionRoutes.get('/market/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const question = c.req.query('question') || 'Unknown market';
  const price = parseFloat(c.req.query('price') || '0.5');
  
  const prediction = await pricePredictor.predictPrice(id, question, price);
  
  return c.json<ApiResponse<PricePrediction>>({
    success: true,
    data: prediction,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// AI 高级预测
predictionRoutes.post('/ai', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    marketId: string;
    question: string;
    currentPrice: number;
    relatedNews?: string[];
  }>();
  
  const history = pricePredictor.getPriceHistory(body.marketId);
  
  const prediction = await pricePredictor.predictWithAI(body.marketId, body.question, {
    currentPrice: body.currentPrice,
    history,
    relatedNews: body.relatedNews,
  });
  
  return c.json<ApiResponse<typeof prediction>>({
    success: true,
    data: prediction,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 批量预测
predictionRoutes.post('/markets', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    markets: { id: string; question: string; price: number }[];
  }>();
  
  const summary = await pricePredictor.getMarketPredictions(body.markets);
  
  return c.json<ApiResponse<typeof summary>>({
    success: true,
    data: summary,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 记录价格（用于积累历史数据）
predictionRoutes.post('/record', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    marketId: string;
    price: number;
    volume?: number;
  }>();
  
  pricePredictor.recordPrice(body.marketId, body.price, body.volume || 0);
  
  return c.json<ApiResponse<{ recorded: boolean }>>({
    success: true,
    data: { recorded: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取价格历史
predictionRoutes.get('/history/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '100');
  
  const history = pricePredictor.getPriceHistory(id, limit);
  
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
