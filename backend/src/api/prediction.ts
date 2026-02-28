/**
 * 价格预测 API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse } from '../core/types';
import { pricePredictor, PricePrediction } from '../services/pricePredictor';
import { predictionAISchema, predictionMarketsSchema, priceRecordSchema } from './schemas';

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
  
  let body: z.infer<typeof predictionAISchema>;
  try {
    body = predictionAISchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
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
  
  let body: z.infer<typeof predictionMarketsSchema>;
  try {
    body = predictionMarketsSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
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
  
  let body: z.infer<typeof priceRecordSchema>;
  try {
    body = priceRecordSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  pricePredictor.recordPrice(body.marketId, body.price, body.volume);
  
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
