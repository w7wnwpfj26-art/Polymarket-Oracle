/**
 * Redis 缓存服务
 * 提供统一的缓存接口，支持多种缓存策略
 */

import { Redis } from 'ioredis';
import type { Market, ArbitrageOpportunity } from '../core/types';
import logger from '../utils/logger';

// 缓存配置
interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: {
    markets: number;        // 市场数据缓存时间 (秒)
    opportunities: number;  // 套利机会缓存时间 (秒)
    orders: number;         // 订单数据缓存时间 (秒)
    config: number;         // 配置缓存时间 (秒)
  };
}

// 默认配置
const DEFAULT_CONFIG: CacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'aegis:',
  ttl: {
    markets: 300,      // 5分钟
    opportunities: 60, // 1分钟
    orders: 300,       // 5分钟
    config: 3600,      // 1小时
  }
};

// 缓存键名枚举
enum CacheKey {
  MARKETS_ALL = 'markets:all',
  MARKET_PREFIX = 'market:',
  OPPORTUNITIES_ALL = 'opportunities:all',
  OPPORTUNITY_PREFIX = 'opportunity:',
  BALANCES = 'balances',
  CONFIG = 'config',
  STATS_DAILY = 'stats:daily',
  AGENT_STATUS = 'agents:status'
}

export class CacheService {
  private redis: Redis | null = null;
  private config: CacheConfig;
  private connected = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.init();
  }

  /**
   * 初始化 Redis 连接
   */
  private async init(): Promise<void> {
    try {
      const redisOptions: Redis.RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.system.warn(`Redis reconnecting... Attempt ${times}, delay ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
      };

      if (this.config.password) {
        redisOptions.password = this.config.password;
      }

      this.redis = new Redis(redisOptions);

      // 连接事件监听
      this.redis.on('connect', () => {
        logger.system.info('Redis connected successfully');
        this.connected = true;
      });

      this.redis.on('error', (err) => {
        logger.system.error('Redis connection error', { error: err.message });
        this.connected = false;
      });

      this.redis.on('close', () => {
        logger.system.warn('Redis connection closed');
        this.connected = false;
      });

      // 测试连接
      await this.redis.ping();
      logger.system.info('Redis cache service initialized');

    } catch (error) {
      logger.system.error('Failed to initialize Redis cache', { error });
      // 不抛出错误，允许系统降级运行
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected && this.redis !== null;
  }

  /**
   * 获取市场列表缓存
   */
  async getCachedMarkets(tag?: string): Promise<Market[] | null> {
    if (!this.isConnected()) return null;

    try {
      const key = tag ? `${CacheKey.MARKETS_ALL}:${tag}` : CacheKey.MARKETS_ALL;
      const cached = await this.redis!.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.system.error('Failed to get cached markets', { error });
      return null;
    }
  }

  /**
   * 设置市场列表缓存
   */
  async setMarketsCache(markets: Market[], tag?: string): Promise<void> {
    if (!this.isConnected() || !this.redis) return;

    try {
      const key = tag ? `${CacheKey.MARKETS_ALL}:${tag}` : CacheKey.MARKETS_ALL;
      await this.redis.setex(
        key,
        this.config.ttl.markets,
        JSON.stringify(markets)
      );
    } catch (error) {
      logger.system.error('Failed to set markets cache', { error });
    }
  }

  /**
   * 获取单个市场缓存
   */
  async getCachedMarket(marketId: string): Promise<Market | null> {
    if (!this.isConnected()) return null;

    try {
      const key = `${CacheKey.MARKET_PREFIX}${marketId}`;
      const cached = await this.redis!.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.system.error('Failed to get cached market', { 
        marketId,
        error: (error as Error).message 
      });
      return null;
    }
  }

  /**
   * 设置单个市场缓存
   */
  async setMarketCache(market: Market): Promise<void> {
    if (!this.isConnected() || !this.redis) return;

    try {
      const key = `${CacheKey.MARKET_PREFIX}${market.id}`;
      await this.redis.setex(
        key,
        this.config.ttl.markets,
        JSON.stringify(market)
      );
    } catch (error) {
      logger.system.error('Failed to set market cache', { 
        marketId: market.id,
        error: (error as Error).message 
      });
    }
  }

  /**
   * 获取套利机会缓存
   */
  async getCachedOpportunities(): Promise<ArbitrageOpportunity[] | null> {
    if (!this.isConnected()) return null;

    try {
      const cached = await this.redis!.get(CacheKey.OPPORTUNITIES_ALL);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.system.error('Failed to get cached opportunities', { error });
      return null;
    }
  }

  /**
   * 设置套利机会缓存
   */
  async setOpportunitiesCache(opportunities: ArbitrageOpportunity[]): Promise<void> {
    if (!this.isConnected() || !this.redis) return;

    try {
      await this.redis.setex(
        CacheKey.OPPORTUNITIES_ALL,
        this.config.ttl.opportunities,
        JSON.stringify(opportunities)
      );
    } catch (error) {
      logger.system.error('Failed to set opportunities cache', { error });
    }
  }

  /**
   * 获取账户余额缓存
   */
  async getCachedBalances(): Promise<Record<string, number> | null> {
    if (!this.isConnected()) return null;

    try {
      const cached = await this.redis!.get(CacheKey.BALANCES);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.system.error('Failed to get cached balances', { error });
      return null;
    }
  }

  /**
   * 设置账户余额缓存
   */
  async setBalancesCache(balances: Record<string, number>): Promise<void> {
    if (!this.isConnected()) return;

    try {
      await this.redis!.setex(
        CacheKey.BALANCES,
        60, // 1分钟缓存
        JSON.stringify(balances)
      );
    } catch (error) {
      logger.system.error('Failed to set balances cache', { error });
    }
  }

  /**
   * 获取配置缓存
   */
  async getCachedConfig<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;

    try {
      const cacheKey = `${CacheKey.CONFIG}:${key}`;
      const cached = await this.redis!.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.system.error('Failed to get cached config', { 
        key,
        error: (error as Error).message 
      });
      return null;
    }
  }

  /**
   * 设置配置缓存
   */
  async setConfigCache<T>(key: string, value: T): Promise<void> {
    if (!this.isConnected() || !this.redis) return;

    try {
      const cacheKey = `${CacheKey.CONFIG}:${key}`;
      await this.redis.setex(
        cacheKey,
        this.config.ttl.config,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.system.error('Failed to set config cache', { 
        key,
        error: (error as Error).message 
      });
    }
  }

  /**
   * 删除指定键的缓存
   */
  async delCache(key: string): Promise<void> {
    if (!this.isConnected()) return;

    try {
      await this.redis!.del(key);
    } catch (error) {
      logger.system.error('Failed to delete cache', { 
        key,
        error: (error as Error).message 
      });
    }
  }

  /**
   * 清空所有缓存
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected()) return;

    try {
      await this.redis!.flushall();
      logger.system.info('All cache flushed');
    } catch (error) {
      logger.system.error('Failed to flush cache', { error });
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    connected: boolean;
    usedMemory?: number;
    keyspaceHits?: number;
    keyspaceMisses?: number;
  }> {
    if (!this.isConnected()) {
      return { connected: false };
    }

    try {
      const info = await this.redis!.info('memory');
      const stats = await this.redis!.info('stats');
      
      // 解析 Redis 信息
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      
      return {
        connected: true,
        usedMemory: memoryMatch ? parseInt(memoryMatch[1]) : undefined,
        keyspaceHits: hitsMatch ? parseInt(hitsMatch[1]) : undefined,
        keyspaceMisses: missesMatch ? parseInt(missesMatch[1]) : undefined,
      };
    } catch (error) {
      logger.system.error('Failed to get cache stats', { error });
      return { connected: false };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        logger.system.info('Redis connection closed');
      } catch (error) {
        logger.system.error('Failed to close Redis connection', { error });
      }
    }
  }
}

// 导出单例
export const cacheService = new CacheService();
export default cacheService;