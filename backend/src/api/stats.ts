/**
 * Statistics API Routes
 */

import { Hono } from 'hono';
import type { ApiResponse } from '../core/types';
import { getDailyStats, getSummaryStats, getLogs } from '../db/repository';
import { getDatabaseStats } from '../db/index';

export const statsRoutes = new Hono();

// Get daily statistics
statsRoutes.get('/daily', async (c) => {
  const start = Date.now();
  const days = parseInt(c.req.query('days') || '30');
  
  try {
    const stats = await getDailyStats(days);
    
    return c.json<ApiResponse<typeof stats>>({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: (error as Error).message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get summary statistics
statsRoutes.get('/summary', async (c) => {
  const start = Date.now();
  
  try {
    const summary = await getSummaryStats();
    
    return c.json<ApiResponse<typeof summary>>({
      success: true,
      data: summary,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: (error as Error).message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get database statistics
statsRoutes.get('/database', async (c) => {
  const start = Date.now();
  
  try {
    const dbStats = getDatabaseStats();
    
    return c.json<ApiResponse<typeof dbStats>>({
      success: true,
      data: dbStats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DB_STATS_ERROR',
        message: (error as Error).message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get system logs
statsRoutes.get('/logs', async (c) => {
  const start = Date.now();
  const level = c.req.query('level');
  const category = c.req.query('category');
  const limit = parseInt(c.req.query('limit') || '100');
  const since = c.req.query('since');
  
  try {
    const logs = await getLogs({ level, category, limit, since });
    
    return c.json<ApiResponse<typeof logs>>({
      success: true,
      data: logs,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'LOGS_ERROR',
        message: (error as Error).message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});
