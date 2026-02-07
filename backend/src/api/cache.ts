/**
 * 缓存管理 API 路由
 */

import { Hono } from 'hono';
import { cacheService } from '../services/cache';
import { authMiddleware, requireRole } from '../middleware/auth';
import logger from '../utils/logger';

export const cacheRoutes = new Hono();

/**
 * 获取缓存统计信息
 * GET /api/cache/stats
 */
cacheRoutes.get('/stats', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  try {
    const stats = await cacheService.getStats();
    
    return c.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to get cache stats', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'CACHE_STATS_ERROR',
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
 * 清空所有缓存
 * POST /api/cache/flush
 */
cacheRoutes.post('/flush', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  
  try {
    await cacheService.flushAll();
    
    logger.system.info('Cache flushed by admin');
    
    return c.json({
      success: true,
      data: { message: 'All cache cleared successfully' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to flush cache', { error });
    
    return c.json({
      success: false,
      error: {
        code: 'CACHE_FLUSH_ERROR',
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
 * 删除特定缓存键
 * DELETE /api/cache/key/:key
 */
cacheRoutes.delete('/key/:key', authMiddleware, requireRole('admin'), async (c) => {
  const start = Date.now();
  const key = c.req.param('key');
  
  try {
    await cacheService.delCache(key);
    
    logger.system.info('Cache key deleted', { key });
    
    return c.json({
      success: true,
      data: { message: `Cache key '${key}' deleted successfully` },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    logger.system.error('Failed to delete cache key', { 
      key,
      error: (error as Error).message 
    });
    
    return c.json({
      success: false,
      error: {
        code: 'CACHE_DELETE_ERROR',
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
 * 测试缓存连接
 * GET /api/cache/ping
 */
cacheRoutes.get('/ping', authMiddleware, requireRole('user', 'admin'), async (c) => {
  const start = Date.now();
  
  try {
    const connected = cacheService.isConnected();
    
    return c.json({
      success: true,
      data: {
        connected,
        message: connected ? 'Redis connected' : 'Redis disconnected'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      }
    });
    
  } catch (error) {
    return c.json({
      success: false,
      data: {
        connected: false,
        message: 'Redis connection failed'
      },
      error: {
        code: 'CACHE_PING_ERROR',
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