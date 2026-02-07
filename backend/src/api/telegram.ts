/**
 * Telegram Bot API Routes
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { telegramBot } from '../services/telegramBot';

export const telegramRoutes = new Hono();

// 获取 Bot 状态
telegramRoutes.get('/status', async (c) => {
  const start = Date.now();
  const status = telegramBot.getStatus();
  
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

// 配置 Bot
telegramRoutes.post('/configure', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    botToken: string;
    chatId: string;
    enabled: boolean;
  }>();
  
  telegramBot.configure(body);
  
  if (body.enabled) {
    telegramBot.startPolling();
  } else {
    telegramBot.stopPolling();
  }
  
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

// 发送测试消息
telegramRoutes.post('/test', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{ chatId?: string; message?: string }>();
  
  const status = telegramBot.getStatus();
  if (!status.configured) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Telegram bot not configured' },
      meta: { timestamp: new Date().toISOString() },
    }, 400);
  }
  
  const success = await telegramBot.sendSystemNotification(
    '测试消息',
    body.message || '这是来自 AEGIS 套利系统的测试消息。如果您收到此消息，说明 Telegram 推送已正确配置！',
    'info'
  );
  
  return c.json<ApiResponse<{ sent: boolean }>>({
    success,
    data: { sent: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 手动推送套利机会
telegramRoutes.post('/push-opportunity', async (c) => {
  const start = Date.now();
  const body = await c.req.json<{
    id: string;
    type: string;
    question: string;
    expectedProfit: number;
    expectedProfitPercent: number;
    worstCaseLoss: number;
    platforms: any;
    confidence: number;
    validUntil: string;
  }>();
  
  const success = await telegramBot.sendArbitrageAlert(body);
  
  return c.json<ApiResponse<{ sent: boolean }>>({
    success,
    data: { sent: success },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// 开始/停止轮询
telegramRoutes.post('/polling/:action', async (c) => {
  const start = Date.now();
  const action = c.req.param('action');
  
  if (action === 'start') {
    telegramBot.startPolling();
  } else if (action === 'stop') {
    telegramBot.stopPolling();
  } else {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Action must be start or stop' },
      meta: { timestamp: new Date().toISOString() },
    }, 400);
  }
  
  return c.json<ApiResponse<{ action: string }>>({
    success: true,
    data: { action },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
