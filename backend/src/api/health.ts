/**
 * 健康检查 API 路由
 */

import { Hono } from 'hono';
import { healthService } from '../services/health';
import logger from '../utils/logger';

export const healthRoutes = new Hono();

/**
 * 快速健康检查 - 用于负载均衡器探针
 * GET /health
 */
healthRoutes.get('/', async (c) => {
  const start = Date.now();
  
  try {
    const result = await healthService.quickHealthCheck();
    
    const statusCode = result.status === 'ok' ? 200 : 503;
    
    return c.json({
      status: result.status,
      message: result.message || 'Service is healthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - start
    }, statusCode);
    
  } catch (error) {
    logger.system.error('Health check failed', { error: (error as Error).message });
    
    return c.json({
      status: 'error',
      message: 'Health check failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, 503);
  }
});

/**
 * 详细健康检查 - 包含所有子系统的状态
 * GET /health/detailed
 */
healthRoutes.get('/detailed', async (c) => {
  const start = Date.now();
  
  try {
    const health = await healthService.checkHealth();
    
    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 200 : 503;
    
    return c.json({
      ...health,
      responseTime: Date.now() - start
    }, statusCode);
    
  } catch (error) {
    logger.system.error('Detailed health check failed', { error: (error as Error).message });
    
    return c.json({
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTime: Date.now() - start
    }, 503);
  }
});

/**
 * 系统指标 - 用于监控
 * GET /health/metrics
 */
healthRoutes.get('/metrics', async (c) => {
  try {
    const health = await healthService.checkHealth();
    
    // 返回 Prometheus 格式的指标（简化版）
    const metrics = `
# HELP aegis_system_health Overall system health status (0=unhealthy, 1=degraded, 2=healthy)
# TYPE aegis_system_health gauge
aegis_system_health{status="${health.overall}"} ${health.overall === 'healthy' ? 2 : health.overall === 'degraded' ? 1 : 0}

# HELP aegis_uptime_seconds System uptime in seconds
# TYPE aegis_uptime_seconds gauge
aegis_uptime_seconds ${health.uptime}

# HELP aegis_database_response_time_ms Database response time in milliseconds
# TYPE aegis_database_response_time_ms gauge
aegis_database_response_time_ms ${health.checks.find(c => c.name === 'database')?.responseTime || 0}

# HELP aegis_cache_response_time_ms Cache response time in milliseconds
# TYPE aegis_cache_response_time_ms gauge
aegis_cache_response_time_ms ${health.checks.find(c => c.name === 'cache')?.responseTime || 0}

# HELP aegis_active_websocket_clients Number of active WebSocket clients
# TYPE aegis_active_websocket_clients gauge
aegis_active_websocket_clients ${health.checks.find(c => c.name === 'websocket')?.details?.clientCount || 0}

# HELP aegis_memory_heap_used_mb Heap memory used in MB
# TYPE aegis_memory_heap_used_mb gauge
aegis_memory_heap_used_mb ${Math.round(health.stats.memory.heapUsed / 1024 / 1024)}

# HELP aegis_memory_heap_total_mb Heap memory total in MB
# TYPE aegis_memory_heap_total_mb gauge
aegis_memory_heap_total_mb ${Math.round(health.stats.memory.heapTotal / 1024 / 1024)}
    `.trim();
    
    return new Response(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    logger.system.error('Metrics collection failed', { error: (error as Error).message });
    
    return c.text('# Metrics collection failed\n', 500, {
      'Content-Type': 'text/plain; version=0.0.4'
    });
  }
});