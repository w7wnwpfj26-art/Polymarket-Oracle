/**
 * Multi-Level Cache System
 * L1: In-Memory (LRU) - Fast, limited size
 * L2: Redis - Persistent, distributed
 * L3: Database - Source of truth
 */

import { cacheService } from './cache';
import logger from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface CacheOptions {
  l1TTL?: number;      // L1 TTL in seconds
  l2TTL?: number;      // L2 TTL in seconds
  maxL1Size?: number;  // Max items in L1
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Update hits and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }
  
  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
  
  getStats() {
    let totalHits = 0;
    let avgAge = 0;
    const now = Date.now();
    
    this.cache.forEach(entry => {
      totalHits += entry.hits;
      avgAge += (now - entry.timestamp);
    });
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      avgAge: this.cache.size > 0 ? avgAge / this.cache.size / 1000 : 0,
      usage: (this.cache.size / this.maxSize * 100).toFixed(2) + '%'
    };
  }
}

class MultiLevelCache {
  private l1Cache: LRUCache<any>;
  private l1Stats = { hits: 0, misses: 0 };
  private l2Stats = { hits: 0, misses: 0 };
  
  constructor() {
    this.l1Cache = new LRUCache(1000); // 1000 items max
  }
  
  /**
   * Get from cache (L1 → L2 → null)
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    
    // Try L1 first
    const l1Result = this.l1Cache.get(key);
    if (l1Result !== null) {
      this.l1Stats.hits++;
      logger.system.info('Cache L1 hit', { 
        key, 
        latencyMs: Date.now() - startTime 
      });
      return l1Result as T;
    }
    this.l1Stats.misses++;
    
    // Try L2 (Redis)
    try {
      const l2Result = await cacheService.get(key);
      if (l2Result !== null) {
        this.l2Stats.hits++;
        
        // Promote to L1
        this.l1Cache.set(key, l2Result);
        
        logger.system.info('Cache L2 hit', { 
          key, 
          latencyMs: Date.now() - startTime 
        });
        return l2Result as T;
      }
      this.l2Stats.misses++;
    } catch (error) {
      logger.system.error('L2 cache error', { key, error });
    }
    
    logger.system.info('Cache miss', { 
      key, 
      latencyMs: Date.now() - startTime 
    });
    return null;
  }
  
  /**
   * Set to both L1 and L2
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    // Set to L1
    this.l1Cache.set(key, value);
    
    // Set to L2
    try {
      const ttl = options?.l2TTL || 3600; // Default 1 hour
      await cacheService.set(key, value, ttl);
    } catch (error) {
      logger.system.error('L2 cache set error', { key, error });
    }
  }
  
  /**
   * Delete from both levels
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    
    try {
      await cacheService.delete(key);
    } catch (error) {
      logger.system.error('L2 cache delete error', { key, error });
    }
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    
    try {
      await cacheService.clear();
    } catch (error) {
      logger.system.error('L2 cache clear error', { error });
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const l1HitRate = this.l1Stats.hits + this.l1Stats.misses > 0
      ? (this.l1Stats.hits / (this.l1Stats.hits + this.l1Stats.misses) * 100).toFixed(2)
      : '0.00';
      
    const l2HitRate = this.l2Stats.hits + this.l2Stats.misses > 0
      ? (this.l2Stats.hits / (this.l2Stats.hits + this.l2Stats.misses) * 100).toFixed(2)
      : '0.00';
    
    return {
      l1: {
        ...this.l1Cache.getStats(),
        hits: this.l1Stats.hits,
        misses: this.l1Stats.misses,
        hitRate: l1HitRate + '%'
      },
      l2: {
        hits: this.l2Stats.hits,
        misses: this.l2Stats.misses,
        hitRate: l2HitRate + '%',
        connected: cacheService.isConnected()
      },
      overall: {
        totalHits: this.l1Stats.hits + this.l2Stats.hits,
        totalMisses: this.l2Stats.misses, // Only count L2 misses as true misses
        hitRate: this.l2Stats.misses > 0
          ? ((this.l1Stats.hits + this.l2Stats.hits) / 
             (this.l1Stats.hits + this.l2Stats.hits + this.l2Stats.misses) * 100).toFixed(2) + '%'
          : 'N/A'
      }
    };
  }
  
  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(dataLoader: () => Promise<Array<{ key: string; value: any }>>): Promise<void> {
    logger.system.info('Cache warm-up started');
    const startTime = Date.now();
    
    try {
      const data = await dataLoader();
      
      for (const { key, value } of data) {
        await this.set(key, value, { l2TTL: 3600 });
      }
      
      logger.system.info('Cache warm-up completed', {
        itemsLoaded: data.length,
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      logger.system.error('Cache warm-up failed', { error });
    }
  }
}

// Export singleton
export const multiLevelCache = new MultiLevelCache();
export default multiLevelCache;
