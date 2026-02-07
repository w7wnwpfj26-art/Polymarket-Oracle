/**
 * 熔断器服务 - Circuit Breaker Pattern
 * 用于防止级联故障和服务雪崩
 */

import logger from '../utils/logger';

// 熔断器状态枚举
export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常状态，允许请求通过
  OPEN = 'OPEN',         // 熔断状态，拒绝所有请求
  HALF_OPEN = 'HALF_OPEN' // 半开状态，允许有限请求通过以测试服务恢复
}

// 熔断器配置
interface CircuitBreakerConfig {
  failureThreshold: number;     // 失败阈值（连续失败次数）
  timeout: number;             // 熔断超时时间（毫秒）
  retryTimeout: number;        // 半开状态下的重试间隔（毫秒）
  successThreshold: number;    // 半开状态下成功次数阈值
}

// 默认配置
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,      // 连续5次失败后熔断
  timeout: 60000,           // 熔断60秒
  retryTimeout: 30000,      // 30秒后尝试半开
  successThreshold: 3       // 半开状态下需要3次成功才算真正恢复
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行受保护的操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 检查是否可以执行操作
    if (!this.canExecute()) {
      throw new CircuitBreakerError(
        `Circuit breaker "${this.name}" is ${this.state}`, 
        this.state
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 检查是否可以执行操作
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        // 检查是否到了半开时间
        if (Date.now() - this.lastFailureTime >= this.config.retryTimeout) {
          this.state = CircuitState.HALF_OPEN;
          this.successCount = 0;
          logger.system.info(`Circuit breaker "${this.name}" entering HALF_OPEN state`);
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }

  /**
   * 处理成功情况
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        // 完全恢复
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.system.info(`Circuit breaker "${this.name}" restored to CLOSED state`);
      }
    } else {
      // 正常状态下的成功，重置失败计数
      this.failureCount = 0;
    }
  }

  /**
   * 处理失败情况
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态下失败，立即回到熔断状态
      this.state = CircuitState.OPEN;
      logger.system.warn(`Circuit breaker "${this.name}" failed in HALF_OPEN state, returning to OPEN`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // 达到失败阈值，熔断
      this.state = CircuitState.OPEN;
      logger.system.error(`Circuit breaker "${this.name}" tripped OPEN after ${this.failureCount} failures`);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    timeUntilRetry: number;
  } {
    const timeUntilRetry = this.state === CircuitState.OPEN 
      ? Math.max(0, this.config.retryTimeout - (Date.now() - this.lastFailureTime))
      : 0;
      
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilRetry
    };
  }

  /**
   * 强制重置熔断器（谨慎使用）
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.system.info(`Circuit breaker "${this.name}" manually reset`);
  }

  /**
   * 强制打开熔断器（用于维护等场景）
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    logger.system.warn(`Circuit breaker "${this.name}" manually forced OPEN`);
  }
}

// 熔断器错误类
export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// 熔断器管理器 - 管理多个熔断器实例
class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * 获取或创建熔断器
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.system.info('All circuit breakers reset');
  }
}

// 导出单例
export const circuitBreakerManager = new CircuitBreakerManager();
export default circuitBreakerManager;