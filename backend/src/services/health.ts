/**
 * 系统健康检查服务
 * 提供全面的系统健康状态监控
 */

import logger from '../utils/logger';
import { db } from '../db/index';
import { sql } from 'drizzle-orm';
import { cacheService } from './cache';
import { circuitBreakerManager } from './circuitBreaker';
import { rateLimitManager } from './rateLimiter';
import wsService from './websocket';

// 健康检查项
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

// 系统健康状态
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  stats: {
    cpu: number;
    memory: NodeJS.MemoryUsage;
    eventLoopDelay: number;
  };
}

class HealthService {
  private startTime: number;
  private eventLoopStarted: boolean = false;

  constructor() {
    this.startTime = Date.now();
    this.startEventLoopMonitoring();
  }

  /**
   * 启动事件循环监控
   */
  private startEventLoopMonitoring(): void {
    if (this.eventLoopStarted) return;
    
    this.eventLoopStarted = true;
    
    // 监控事件循环延迟
    const interval = setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const delay = Number(end - start) / 1000000; // 转换为毫秒
        
        if (delay > 100) { // 如果延迟超过100ms，记录警告
          logger.system.warn('Event loop delay detected', { delayMs: delay });
        }
      });
    }, 1000);
    
    // 防止进程退出
    interval.unref();
  }

  /**
   * 执行全面健康检查
   */
  async checkHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // 1. 数据库检查
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);
    
    // 2. 缓存检查
    const cacheCheck = await this.checkCache();
    checks.push(cacheCheck);
    
    // 3. WebSocket 服务检查
    const wsCheck = this.checkWebSocket();
    checks.push(wsCheck);
    
    // 4. 系统资源检查
    const resourceCheck = this.checkSystemResources();
    checks.push(resourceCheck);
    
    // 5. 熔断器状态检查
    const circuitCheck = this.checkCircuitBreakers();
    checks.push(circuitCheck);
    
    // 6. 限流器状态检查
    const rateLimitCheck = this.checkRateLimiters();
    checks.push(rateLimitCheck);
    
    // 确定总体状态
    const unhealthyChecks = checks.filter(c => c.status === 'unhealthy').length;
    const degradedChecks = checks.filter(c => c.status === 'degraded').length;
    
    if (unhealthyChecks > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedChecks > 0) {
      overallStatus = 'degraded';
    }
    
    return {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      checks,
      stats: {
        cpu: this.getCpuUsage(),
        memory: process.memoryUsage(),
        eventLoopDelay: this.getEventLoopDelay()
      }
    };
  }

  /**
   * 检查数据库连接
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // 使用 Drizzle ORM 执行简单的查询
      const result = await db.all(sql`SELECT 1 as test`);
      
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection OK',
        responseTime: Date.now() - start,
        details: {
          queryResult: result[0].test
        }
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
        responseTime: Date.now() - start
      };
    }
  }

  /**
   * 检查缓存服务
   */
  private async checkCache(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const connected = cacheService.isConnected();
      
      if (!connected) {
        return {
          name: 'cache',
          status: 'degraded',
          message: 'Cache service disconnected',
          responseTime: Date.now() - start
        };
      }
      
      // 测试缓存读写
      const testKey = 'health:test';
      await cacheService.setConfigCache(testKey, 'test');
      const value = await cacheService.getCachedConfig<string>(testKey);
      
      if (value === 'test') {
        return {
          name: 'cache',
          status: 'healthy',
          message: 'Cache service OK',
          responseTime: Date.now() - start
        };
      } else {
        return {
          name: 'cache',
          status: 'degraded',
          message: 'Cache read/write test failed',
          responseTime: Date.now() - start
        };
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'unhealthy',
        message: `Cache service error: ${(error as Error).message}`,
        responseTime: Date.now() - start
      };
    }
  }

  /**
   * 检查 WebSocket 服务
   */
  private checkWebSocket(): HealthCheck {
    try {
      const clientCount = wsService.getClientCount();
      
      return {
        name: 'websocket',
        status: clientCount >= 0 ? 'healthy' : 'degraded',
        message: `WebSocket service running with ${clientCount} clients`,
        details: {
          clientCount,
          clients: wsService.getClients()
        }
      };
    } catch (error) {
      return {
        name: 'websocket',
        status: 'unhealthy',
        message: `WebSocket service error: ${(error as Error).message}`
      };
    }
  }

  /**
   * 检查系统资源
   */
  private checkSystemResources(): HealthCheck {
    const memory = process.memoryUsage();
    const memoryUsage = (memory.heapUsed / memory.heapTotal) * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'System resources OK';
    
    if (memoryUsage > 90) {
      status = 'unhealthy';
      message = `High memory usage: ${memoryUsage.toFixed(1)}%`;
    } else if (memoryUsage > 75) {
      status = 'degraded';
      message = `Moderate memory usage: ${memoryUsage.toFixed(1)}%`;
    }
    
    return {
      name: 'system_resources',
      status,
      message,
      details: {
        memoryUsage: memoryUsage.toFixed(2) + '%',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memory.external / 1024 / 1024) + 'MB',
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
      }
    };
  }

  /**
   * 检查熔断器状态
   */
  private checkCircuitBreakers(): HealthCheck {
    try {
      const stats = circuitBreakerManager.getAllStats();
      const openBreakers = Object.entries(stats).filter(([_, stat]) => 
        stat.state === 'OPEN'
      ).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'All circuit breakers closed';
      
      if (openBreakers > 0) {
        status = openBreakers > 2 ? 'unhealthy' : 'degraded';
        message = `${openBreakers} circuit breakers are open`;
      }
      
      return {
        name: 'circuit_breakers',
        status,
        message,
        details: stats
      };
    } catch (error) {
      return {
        name: 'circuit_breakers',
        status: 'unhealthy',
        message: `Circuit breaker check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 检查限流器状态
   */
  private checkRateLimiters(): HealthCheck {
    try {
      const stats = rateLimitManager.getAllStats();
      const activeBuckets = Object.values(stats).reduce((sum, s: any) => 
        sum + (s.activeBuckets || 0), 0
      );
      
      return {
        name: 'rate_limiters',
        status: 'healthy',
        message: `Rate limiters active with ${activeBuckets} buckets`,
        details: stats
      };
    } catch (error) {
      return {
        name: 'rate_limiters',
        status: 'degraded',
        message: `Rate limiter check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取 CPU 使用率（简化版）
   */
  private getCpuUsage(): number {
    // 这是一个简化的实现，实际生产环境应该使用更精确的方法
    const startUsage = process.cpuUsage();
    const start = Date.now();
    
    // 执行一些计算密集型操作来测量CPU
    let count = 0;
    for (let i = 0; i < 1000000; i++) {
      count += i;
    }
    
    const endUsage = process.cpuUsage(startUsage);
    const end = Date.now();
    
    const cpuTime = endUsage.user + endUsage.system; // 微秒
    const wallTime = (end - start) * 1000; // 微秒
    
    return (cpuTime / wallTime) * 100;
  }

  /**
   * 获取事件循环延迟
   */
  private getEventLoopDelay(): number {
    // 简化实现，实际应该使用专门的库如 event-loop-delay
    return 0;
  }

  /**
   * 快速健康检查（用于负载均衡器探针）
   */
  async quickHealthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await db.all(sql`SELECT 1`);
      return { status: 'ok' };
    } catch (error) {
      return { 
        status: 'error', 
        message: (error as Error).message 
      };
    }
  }
}

// 导出单例
export const healthService = new HealthService();
export default healthService;