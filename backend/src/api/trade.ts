/**
 * 交易执行 API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { tradeExecutionService } from '../services/tradeExecution';
import { authMiddleware, requireRole } from '../middleware/auth';
import logger from '../utils/logger';

export const tradeRoutes = new Hono();

// 配置交易所凭证 Schema
const configureExchangeSchema = z.object({
  platform: z.enum(['Polymarket', 'Kalshi', 'Bet365', 'Pinnacle']),
  config: z.object({
    privateKey: z.string().optional(), // Polymarket 钱包私钥
    rpcUrl: z.string().optional(),     // RPC 节点 URL
    username: z.string().optional(),   // 传统博彩用户名
    password: z.string().optional(),   // 传统博彩密码
    apiKey: z.string().optional(),     // API 密钥
  })
});

// 执行交易计划 Schema
const executePlanSchema = z.object({
  planId: z.string(),
  confirm: z.boolean().optional().default(false)
});

/**
 * 配置交易所凭证
 * POST /api/trade/configure
 */
tradeRoutes.post('/configure', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  try {
    const body = await c.req.json();
    const { platform, config } = configureExchangeSchema.parse(body);
    
    await tradeExecutionService.configureExchange(platform, config);
    
    logger.system.info('Exchange configured', { platform });
    
    return c.json({
      success: true,
      data: { message: `${platform} configured successfully` },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: error.errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTimeMs: Date.now() - start,
        }
      }, 400);
    }
    
    logger.system.error('Failed to configure exchange', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: (error as Error).message
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    }, 500);
  }
});

/**
 * 获取账户余额
 * GET /api/trade/balances
 */
tradeRoutes.get('/balances', authMiddleware, requireRole('user', 'admin'), async (c) => {
  const start = Date.now();
  
  try {
    const balances = await tradeExecutionService.getBalances();
    
    return c.json({
      success: true,
      data: balances,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to get balances', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'BALANCE_ERROR',
        message: (error as Error).message
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    }, 500);
  }
});

/**
 * 获取交易历史
 * GET /api/trade/history
 */
tradeRoutes.get('/history', authMiddleware, requireRole('user', 'admin'), async (c) => {
  const start = Date.now();
  const limit = parseInt(c.req.query('limit') || '50');
  
  try {
    const history = tradeExecutionService.getTradeHistory(Math.min(limit, 100));
    
    return c.json({
      success: true,
      data: history,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to get trade history', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'HISTORY_ERROR',
        message: (error as Error).message
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    }, 500);
  }
});

/**
 * 手动执行交易计划
 * POST /api/trade/execute-plan
 */
tradeRoutes.post('/execute-plan', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  try {
    const body = await c.req.json();
    const { planId, confirm } = executePlanSchema.parse(body);
    
    // 这里应该从数据库获取计划，简化起见直接创建一个示例
    const mockPlan = {
      id: planId,
      executionSteps: [
        {
          order: 1,
          platform: 'Polymarket',
          action: 'BUY',
          market: 'test-market',
          side: 'YES',
          amount: 100,
          expectedPrice: 0.5,
          slippageTolerance: 0.02,
          status: 'PENDING'
        }
      ]
    } as any;
    
    if (!confirm) {
      return c.json({
        success: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Please confirm execution by setting confirm=true'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTimeMs: Date.now() - start,
        }
      }, 400);
    }
    
    const result = await tradeExecutionService.executePlan(mockPlan);
    
    return c.json({
      success: result.success,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: error.errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTimeMs: Date.now() - start,
        }
      }, 400);
    }
    
    logger.system.error('Failed to execute trade plan', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: (error as Error).message
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    }, 500);
  }
});

/**
 * 启动交易监控
 * POST /api/trade/start-monitoring
 */
tradeRoutes.post('/start-monitoring', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  try {
    await tradeExecutionService.monitorTrades();
    
    logger.system.info('Trade monitoring started');
    
    return c.json({
      success: true,
      data: { message: 'Trade monitoring started successfully' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to start trade monitoring', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'MONITORING_ERROR',
        message: (error as Error).message
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    }, 500);
  }
});