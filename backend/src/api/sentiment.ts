/**
 * 情绪分析 API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiResponse } from '../core/types';
import { sentimentAnalyzer, MarketSentiment } from '../services/sentimentAnalyzer';
import { sentimentMarketsSchema, sentimentAnalyzeSchema, sentimentConfigureSchema } from './schemas';

export const sentimentRoutes = new Hono();

// 分析单个市场情绪
sentimentRoutes.get('/market/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  const question = c.req.query('question') || 'Unknown market';
  
  const result = await sentimentAnalyzer.analyzeMarket(id, question);
  
  return c.json<ApiResponse<MarketSentiment>>({
    success: true,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 批量分析市场情绪
sentimentRoutes.post('/markets', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof sentimentMarketsSchema>;
  try {
    body = sentimentMarketsSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  const results = await sentimentAnalyzer.analyzeMarkets(body.markets);
  
  return c.json<ApiResponse<MarketSentiment[]>>({
    success: true,
    data: results,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 分析文本情绪
sentimentRoutes.post('/analyze', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof sentimentAnalyzeSchema>;
  try {
    body = sentimentAnalyzeSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  const result = await sentimentAnalyzer.analyzeTextWithAI(body.text);
  
  return c.json<ApiResponse<typeof result>>({
    success: true,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 获取趋势话题
sentimentRoutes.get('/trending', async (c) => {
  const start = Date.now();
  
  const topics = await sentimentAnalyzer.getTrendingTopics();
  
  return c.json<ApiResponse<typeof topics>>({
    success: true,
    data: topics,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 配置情绪分析服务
sentimentRoutes.post('/configure', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof sentimentConfigureSchema>;
  try {
    body = sentimentConfigureSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => e.message).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400);
  }
  
  sentimentAnalyzer.configure(body);
  
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
