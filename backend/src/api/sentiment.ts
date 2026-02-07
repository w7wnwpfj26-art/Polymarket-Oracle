/**
 * 情绪分析 API Routes
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { sentimentAnalyzer, MarketSentiment } from '../services/sentimentAnalyzer';

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
  const body = await c.req.json<{ markets: { id: string; question: string }[] }>();
  
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
  const body = await c.req.json<{ text: string }>();
  
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
  const body = await c.req.json<{
    twitterApiKey?: string;
    redditClientId?: string;
    redditClientSecret?: string;
    newsApiKey?: string;
  }>();
  
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
