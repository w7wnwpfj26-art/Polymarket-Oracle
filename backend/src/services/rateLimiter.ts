/**
 * 高级限流服务 - Token Bucket Algorithm
 * 支持多种限流策略和动态调整
 */

import logger from '../utils/logger';

// 限流配置
interface RateLimitConfig {
  tokensPerInterval: number;  // 每个时间间隔产生的令牌数
  interval: number;           // 时间间隔（毫秒）
  capacity: number;           // 桶的最大容量
  keyPrefix?: string;         // 键前缀，用于区分不同类型的限流
}

// 默认配置
const DEFAULT_CONFIG: RateLimitConfig = {
  tokensPerInterval: 100,     // 每秒100个请求
  interval: 1000,             // 1秒间隔
  capacity: 200,              // 最大200个令牌
  keyPrefix: 'ratelimit:'
};

export class TokenBucketRateLimiter {
  private buckets: Map<string, {
    tokens: number;
    lastRefill: number;
  }> = new Map();
  
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 定期清理过期的桶
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
  }

  /**
   * 检查是否允许请求通过
   */
  async consume(key: string, tokens = 1): Promise<{
    allowed: boolean;
    remainingTokens: number;
    resetTime: number;
  }> {
    const bucketKey = `${this.config.keyPrefix}${key}`;
    const now = Date.now();
    
    // 获取或创建桶
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        tokens: this.config.capacity,
        lastRefill: now
      };
      this.buckets.set(bucketKey, bucket);
    }

    // 补充令牌
    this.refillBucket(bucket, now);

    // 检查是否有足够令牌
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return {
        allowed: true,
        remainingTokens: bucket.tokens,
        resetTime: this.calculateResetTime(bucket.tokens)
      };
    }

    return {
      allowed: false,
      remainingTokens: bucket.tokens,
      resetTime: this.calculateResetTime(bucket.tokens)
    };
  }

  /**
   * 补充桶中的令牌
   */
  private refillBucket(bucket: { tokens: number; lastRefill: number }, now: number): void {
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.interval) * this.config.tokensPerInterval;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  /**
   * 计算重置时间
   */
  private calculateResetTime(currentTokens: number): number {
    const tokensNeeded = this.config.tokensPerInterval - currentTokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.config.tokensPerInterval);
    return Date.now() + (intervalsNeeded * this.config.interval);
  }

  /**
   * 获取桶的当前状态
   */
  getBucketInfo(key: string): {
    tokens: number;
    capacity: number;
    refillRate: number;
    nextRefill: number;
  } | null {
    const bucketKey = `${this.config.keyPrefix}${key}`;
    const bucket = this.buckets.get(bucketKey);
    
    if (!bucket) return null;
    
    return {
      tokens: bucket.tokens,
      capacity: this.config.capacity,
      refillRate: this.config.tokensPerInterval,
      nextRefill: bucket.lastRefill + this.config.interval
    };
  }

  /**
   * 清理过期的桶（超过5分钟未使用的）
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > 300000) { // 5分钟
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.buckets.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      logger.system.info(`Cleaned up ${expiredKeys.length} expired rate limit buckets`);
    }
  }

  /**
   * 重置特定键的桶
   */
  reset(key: string): void {
    const bucketKey = `${this.config.keyPrefix}${key}`;
    this.buckets.delete(bucketKey);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeBuckets: number;
    totalCapacity: number;
    config: RateLimitConfig;
  } {
    return {
      activeBuckets: this.buckets.size,
      totalCapacity: this.buckets.size * this.config.capacity,
      config: { ...this.config }
    };
  }
}

// 滑动窗口限流器
export class SlidingWindowRateLimiter {
  private windows: Map<string, number[]> = new Map();
  private windowSize: number; // 窗口大小（毫秒）
  private maxRequests: number; // 窗口内最大请求数

  constructor(windowSize: number = 60000, maxRequests: number = 100) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    // 定期清理过期数据
    setInterval(() => this.cleanup(), 30000);
  }

  /**
   * 检查是否允许请求
   */
  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const windowKey = `window:${key}`;
    
    let timestamps = this.windows.get(windowKey) || [];
    
    // 移除窗口外的时间戳
    timestamps = timestamps.filter(timestamp => now - timestamp < this.windowSize);
    
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    
    // 添加当前时间戳
    timestamps.push(now);
    this.windows.set(windowKey, timestamps);
    
    return true;
  }

  /**
   * 获取当前窗口内的请求数
   */
  getCurrentCount(key: string): number {
    const now = Date.now();
    const timestamps = this.windows.get(`window:${key}`) || [];
    return timestamps.filter(timestamp => now - timestamp < this.windowSize).length;
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, timestamps] of this.windows) {
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < this.windowSize);
      if (validTimestamps.length === 0) {
        expiredKeys.push(key);
      } else {
        this.windows.set(key, validTimestamps);
      }
    }
    
    for (const key of expiredKeys) {
      this.windows.delete(key);
    }
  }
}

// 漏桶限流器
export class LeakyBucketRateLimiter {
  private buckets: Map<string, {
    drops: number;
    lastLeak: number;
  }> = new Map();
  
  private leakRate: number; // 每毫秒漏出的数量
  private capacity: number; // 桶容量

  constructor(leakRatePerSecond: number = 10, capacity: number = 50) {
    this.leakRate = leakRatePerSecond / 1000; // 转换为每毫秒
    this.capacity = capacity;
    // 定期漏水
    setInterval(() => this.leakAll(), 1000);
  }

  /**
   * 尝试添加水滴
   */
  async addDrop(key: string): Promise<boolean> {
    const bucketKey = `leaky:${key}`;
    const now = Date.now();
    
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = { drops: 0, lastLeak: now };
      this.buckets.set(bucketKey, bucket);
    }

    // 先漏水
    this.leak(bucket, now);

    // 检查是否还能加水
    if (bucket.drops < this.capacity) {
      bucket.drops++;
      return true;
    }

    return false;
  }

  /**
   * 漏水
   */
  private leak(bucket: { drops: number; lastLeak: number }, now: number): void {
    const timePassed = now - bucket.lastLeak;
    const dropsToLeak = Math.floor(timePassed * this.leakRate);
    
    bucket.drops = Math.max(0, bucket.drops - dropsToLeak);
    bucket.lastLeak = now;
  }

  /**
   * 为所有桶漏水
   */
  private leakAll(): void {
    const now = Date.now();
    for (const bucket of this.buckets.values()) {
      this.leak(bucket, now);
    }
  }

  /**
   * 获取当前水滴数
   */
  getCurrentDrops(key: string): number {
    const bucket = this.buckets.get(`leaky:${key}`);
    return bucket ? bucket.drops : 0;
  }
}

// 限流管理器
class RateLimitManager {
  private tokenBuckets: Map<string, TokenBucketRateLimiter> = new Map();
  private slidingWindows: Map<string, SlidingWindowRateLimiter> = new Map();
  private leakyBuckets: Map<string, LeakyBucketRateLimiter> = new Map();

  getTokenBucket(name: string, config?: Partial<RateLimitConfig>): TokenBucketRateLimiter {
    if (!this.tokenBuckets.has(name)) {
      this.tokenBuckets.set(name, new TokenBucketRateLimiter(config));
    }
    return this.tokenBuckets.get(name)!;
  }

  getSlidingWindow(name: string, windowSize?: number, maxRequests?: number): SlidingWindowRateLimiter {
    if (!this.slidingWindows.has(name)) {
      this.slidingWindows.set(name, new SlidingWindowRateLimiter(windowSize, maxRequests));
    }
    return this.slidingWindows.get(name)!;
  }

  getLeakyBucket(name: string, leakRatePerSecond?: number, capacity?: number): LeakyBucketRateLimiter {
    if (!this.leakyBuckets.has(name)) {
      this.leakyBuckets.set(name, new LeakyBucketRateLimiter(leakRatePerSecond, capacity));
    }
    return this.leakyBuckets.get(name)!;
  }

  getAllStats(): any {
    const stats: any = {};
    
    for (const [name, limiter] of this.tokenBuckets) {
      stats[`token_bucket_${name}`] = limiter.getStats();
    }
    
    return stats;
  }
}

// 导出单例
export const rateLimitManager = new RateLimitManager();
export default rateLimitManager;