/**
 * AEGIS Arbitrage System - Backend Server
 * Built with Hono + Node.js (2026 Stack)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';

import { marketRoutes } from './api/markets';
import { arbitrageRoutes } from './api/arbitrage';
import { agentRoutes } from './api/agents';
import { systemRoutes } from './api/system';
import { configRoutes } from './api/config';
import { statsRoutes } from './api/stats';
import { docsRoutes } from './api/openapi';
import { traditionalBettingRoutes } from './api/traditionalBetting';
import { translateRoutes } from './api/translate';
import { hedgeRoutes } from './api/hedge';
import { telegramRoutes } from './api/telegram';
import { authRoutes } from './api/auth';
import { kalshiRoutes } from './api/kalshi';
import { sentimentRoutes } from './api/sentiment';
import { copyTradingRoutes } from './api/copyTrading';
import { predictionRoutes } from './api/prediction';
import { tradeRoutes } from './api/trade';
import { cacheRoutes } from './api/cache';
import { healthRoutes } from './api/health';
import { systemStatusRoutes } from './api/systemStatus';
import { wsHandler } from './api/websocket';
import { initializeDatabase, getDatabaseStats } from './db/index';
import logger from './utils/logger';
import wsService from './services/websocket';
import type { ApiResponse, SystemStatus } from './core/types';
import { authMiddleware, globalRateLimitMiddleware } from './middleware/auth';
import { globalErrorHandler, requestIdMiddleware, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/security';

// ============================================
// App Configuration
// ============================================

const app = new Hono();

// Request ID middleware (must be first)
app.use('*', requestIdMiddleware());

// Security headers
app.use('*', securityHeaders({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// Middleware
app.use('*', cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:5176', 'http://localhost:3000', 'http://localhost:7700'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use('*', honoLogger());
app.use('*', prettyJSON());

// 全局限流 - 按 IP 每分钟 200 请求（可通过 RATE_LIMIT_PER_MINUTE 环境变量调整）
app.use('*', globalRateLimitMiddleware);

// ============================================
// Health Check & Root
// ============================================

app.get('/', (c) => {
  return c.json<ApiResponse<{ name: string; version: string; status: string }>>({
    success: true,
    data: {
      name: 'AEGIS Arbitrage System',
      version: '2.0.0',
      status: 'operational',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: 0,
    },
  });
});

app.get('/health', async (c) => {
  const dbStats = getDatabaseStats();
  const { cacheService } = await import('./services/cache');
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStats,
    redis: cacheService.isConnected() ? 'connected' : 'disconnected',
  });
});

// 健康检查路由
app.route('/health', healthRoutes);

// ============================================
// API Routes
// ============================================

// Protected routes
app.use('/api/config/*', authMiddleware);
app.use('/api/betting/*', authMiddleware);
app.use('/api/telegram/*', authMiddleware);
app.use('/api/copy/*', authMiddleware);
app.use('/api/arbitrage/*', authMiddleware);
app.use('/api/hedge/*', authMiddleware);
app.use('/api/prediction/*', authMiddleware);
app.use('/api/kalshi/*', authMiddleware);
app.use('/api/sentiment/*', authMiddleware);

app.route('/api/markets', marketRoutes);
app.route('/api/arbitrage', arbitrageRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/system', systemRoutes);
app.route('/api/config', configRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/docs', docsRoutes);
app.route('/api/betting', traditionalBettingRoutes);
app.route('/api/translate', translateRoutes);
app.route('/api/hedge', hedgeRoutes);
app.route('/api/telegram', telegramRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/kalshi', kalshiRoutes);
app.route('/api/sentiment', sentimentRoutes);
app.route('/api/copy', copyTradingRoutes);
app.route('/api/prediction', predictionRoutes);
app.route('/api/trade', tradeRoutes); // 新增交易执行路由
app.route('/api/cache', cacheRoutes); // 新增缓存管理路由
app.route('/api/system-status', systemStatusRoutes); // 系统状态仪表板

// ============================================
// WebSocket for Real-time Updates
// ============================================

app.get('/ws', wsHandler);

// ============================================
// Static Files (Serve Frontend in Production)
// ============================================

// Static serving handled by Vite in development

// ============================================
// Error Handlers
// ============================================

// Global error handler
app.onError(globalErrorHandler());

// 404 Not Found handler
app.notFound(notFoundHandler());

// ============================================
// 404 Handler
// ============================================

app.notFound((c) => {
  return c.json<ApiResponse<null>>({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.path} not found`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: 0,
    },
  }, 404);
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 7700;

// Initialize database and services
initializeDatabase().then(() => {
  logger.system.info('Database initialized successfully');
  
  // Start WebSocket server on port 7701
  wsService.start(7701);
  logger.system.info('WebSocket server started on port 7701');
}).catch((err) => {
  logger.system.error('Failed to initialize database', { error: err.message });
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   █████╗ ███████╗ ██████╗ ██╗███████╗                    ║
║  ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝                    ║
║  ███████║█████╗  ██║  ███╗██║███████╗                    ║
║  ██╔══██║██╔══╝  ██║   ██║██║╚════██║                    ║
║  ██║  ██║███████╗╚██████╔╝██║███████║                    ║
║  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝                    ║
║                                                           ║
║   Arbitrage System v2.0.0                                 ║
║   Built with Hono + Node.js (2026 Stack)                 ║
║                                                           ║
║   🚀 Server running on http://localhost:${PORT}             ║
║   📡 WebSocket on ws://localhost:7701                       ║
║   📊 API Docs: http://localhost:${PORT}/api                 ║
║   🗄️  Database: SQLite + Drizzle ORM                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Start server using @hono/node-server
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.system.info(`Received ${signal}, shutting down gracefully...`);
  try {
    wsService.stop();
    const { cacheService } = await import('./services/cache');
    await cacheService.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000); // Force exit if close hangs
  } catch (err) {
    logger.system.error('Shutdown error', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
