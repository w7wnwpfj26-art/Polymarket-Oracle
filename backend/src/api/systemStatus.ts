/**
 * System Status Dashboard API
 * Provides comprehensive system health and performance metrics
 */

import { Hono } from 'hono';
import { queryOptimizer } from '../db/optimizer';
import { multiLevelCache } from '../services/multiLevelCache';
import { cacheService } from '../services/cache';
import { getDatabaseStats } from '../db/index';
import logger from '../utils/logger';

export const systemStatusRoutes = new Hono();

/**
 * GET /api/system-status/dashboard
 * Complete system status dashboard
 */
systemStatusRoutes.get('/dashboard', async (c) => {
  const start = Date.now();
  
  try {
    // Gather all metrics
    const [
      cacheStats,
      dbStats,
      queryStats,
      dbFileStats
    ] = await Promise.all([
      Promise.resolve(multiLevelCache.getStats()),
      Promise.resolve(getDatabaseStats()),
      Promise.resolve(queryOptimizer.getStats()),
      Promise.resolve(queryOptimizer.getDbStats())
    ]);
    
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return c.json({
      success: true,
      data: {
        system: {
          uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
          },
          memory: {
            heapUsed: formatBytes(memoryUsage.heapUsed),
            heapTotal: formatBytes(memoryUsage.heapTotal),
            rss: formatBytes(memoryUsage.rss),
            external: formatBytes(memoryUsage.external),
            usagePercentage: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2) + '%'
          },
          process: {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch
          }
        },
        cache: {
          multiLevel: cacheStats,
          redis: {
            connected: cacheService.isConnected(),
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || '6379'
          }
        },
        database: {
          stats: dbStats,
          file: dbFileStats,
          queries: queryStats
        },
        health: {
          status: 'healthy',
          checks: {
            database: dbStats.totalRecords >= 0 ? 'pass' : 'fail',
            cache: cacheService.isConnected() ? 'pass' : 'warn',
            memory: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'pass' : 'warn'
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (c.get as any)('requestId') || crypto.randomUUID(),
        processingTimeMs: Date.now() - start
      }
    });
  } catch (error) {
    logger.system.error('Failed to get system status', { error });
    return c.json({
      success: false,
      error: {
        code: 'SYSTEM_STATUS_ERROR',
        message: (error as Error).message
      }
    }, 500);
  }
});

/**
 * GET /api/system-status/cache
 * Detailed cache statistics
 */
systemStatusRoutes.get('/cache', async (c) => {
  return c.json({
    success: true,
    data: multiLevelCache.getStats()
  });
});

/**
 * GET /api/system-status/queries
 * Database query performance
 */
systemStatusRoutes.get('/queries', async (c) => {
  return c.json({
    success: true,
    data: queryOptimizer.getStats()
  });
});

/**
 * GET /api/system-status/indexes
 * Database index analysis
 */
systemStatusRoutes.get('/indexes', async (c) => {
  try {
    const indexInfo = queryOptimizer.analyzeIndexes();
    return c.json({
      success: true,
      data: indexInfo
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'INDEX_ANALYSIS_ERROR',
        message: (error as Error).message
      }
    }, 500);
  }
});

/**
 * POST /api/system-status/optimize
 * Run database optimization
 */
systemStatusRoutes.post('/optimize', async (c) => {
  try {
    const [vacuumResult, analyzeResult] = await Promise.all([
      queryOptimizer.vacuum(),
      queryOptimizer.analyze()
    ]);
    
    return c.json({
      success: true,
      data: {
        vacuum: vacuumResult,
        analyze: analyzeResult
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OPTIMIZATION_ERROR',
        message: (error as Error).message
      }
    }, 500);
  }
});

/**
 * DELETE /api/system-status/cache
 * Clear all caches
 */
systemStatusRoutes.delete('/cache', async (c) => {
  try {
    await multiLevelCache.clear();
    
    return c.json({
      success: true,
      data: {
        message: 'All caches cleared successfully'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_ERROR',
        message: (error as Error).message
      }
    }, 500);
  }
});

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
