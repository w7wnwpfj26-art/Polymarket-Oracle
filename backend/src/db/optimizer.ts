/**
 * Database Query Optimizer
 * Provides query performance analysis and optimization utilities
 */

import { getDb } from './index';
import logger from '../utils/logger';

interface QueryStats {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: Date;
}

class QueryOptimizer {
  private queryStats: QueryStats[] = [];
  private slowQueryThreshold = 100; // ms
  
  /**
   * Log slow queries for analysis
   */
  logQuery(query: string, executionTime: number, rowsAffected: number = 0) {
    const stats: QueryStats = {
      query: query.substring(0, 200), // Truncate for logging
      executionTime,
      rowsAffected,
      timestamp: new Date()
    };
    
    this.queryStats.push(stats);
    
    // Keep only last 1000 queries
    if (this.queryStats.length > 1000) {
      this.queryStats.shift();
    }
    
    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      logger.db.warn('Slow query detected', stats);
    }
  }
  
  /**
   * Get query statistics
   */
  getStats() {
    const totalQueries = this.queryStats.length;
    const slowQueries = this.queryStats.filter(q => q.executionTime > this.slowQueryThreshold);
    
    const avgExecutionTime = totalQueries > 0
      ? this.queryStats.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
      : 0;
    
    return {
      totalQueries,
      slowQueries: slowQueries.length,
      slowQueryPercentage: totalQueries > 0 ? (slowQueries.length / totalQueries * 100).toFixed(2) + '%' : '0%',
      avgExecutionTime: avgExecutionTime.toFixed(2) + 'ms',
      threshold: this.slowQueryThreshold + 'ms',
      recentSlowQueries: slowQueries.slice(-10).map(q => ({
        query: q.query,
        time: q.executionTime + 'ms',
        timestamp: q.timestamp
      }))
    };
  }
  
  /**
   * Analyze table indexes
   */
  analyzeIndexes() {
    const db = getDb();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;
    
    const indexInfo: Record<string, any> = {};
    
    for (const { name } of tables) {
      const indexes = db.prepare(`PRAGMA index_list(${name})`).all();
      const tableInfo = db.prepare(`PRAGMA table_info(${name})`).all();
      
      indexInfo[name] = {
        columns: tableInfo,
        indexes: indexes,
        recommendations: this.recommendIndexes(name, tableInfo as any[], indexes as any[])
      };
    }
    
    return indexInfo;
  }
  
  /**
   * Recommend missing indexes based on query patterns
   */
  private recommendIndexes(
    tableName: string, 
    columns: Array<{ name: string; type: string }>,
    existingIndexes: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for foreign key columns without indexes
    const fkColumns = columns.filter(c => 
      c.name.endsWith('_id') || c.name.includes('Id')
    );
    
    for (const col of fkColumns) {
      const hasIndex = existingIndexes.some((idx: any) => 
        idx.name.includes(col.name)
      );
      
      if (!hasIndex) {
        recommendations.push(
          `CREATE INDEX idx_${tableName}_${col.name} ON ${tableName}(${col.name});`
        );
      }
    }
    
    // Recommend composite indexes for common query patterns
    if (tableName === 'opportunities') {
      const hasStatusCreatedIndex = existingIndexes.some((idx: any) => 
        idx.name.includes('status') && idx.name.includes('created')
      );
      if (!hasStatusCreatedIndex) {
        recommendations.push(
          `CREATE INDEX idx_opportunities_status_created ON opportunities(status, created_at DESC);`
        );
      }
    }
    
    return recommendations;
  }
  
  /**
   * Vacuum database to reclaim space and optimize
   */
  async vacuum() {
    const db = getDb();
    const start = Date.now();
    
    try {
      db.exec('VACUUM');
      const duration = Date.now() - start;
      
      logger.db.info('Database vacuumed successfully', { durationMs: duration });
      
      return { success: true, durationMs: duration };
    } catch (error) {
      logger.db.error('Database vacuum failed', { error });
      return { success: false, error };
    }
  }
  
  /**
   * Analyze database for optimization
   */
  async analyze() {
    const db = getDb();
    const start = Date.now();
    
    try {
      db.exec('ANALYZE');
      const duration = Date.now() - start;
      
      logger.db.info('Database analyzed successfully', { durationMs: duration });
      
      return { success: true, durationMs: duration };
    } catch (error) {
      logger.db.error('Database analyze failed', { error });
      return { success: false, error };
    }
  }
  
  /**
   * Get database file size and statistics
   */
  getDbStats() {
    const db = getDb();
    
    const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };
    const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
    const freePages = db.prepare('PRAGMA freelist_count').get() as { freelist_count: number };
    
    const totalSize = pageCount.page_count * pageSize.page_size;
    const freeSize = freePages.freelist_count * pageSize.page_size;
    const usedSize = totalSize - freeSize;
    
    return {
      totalSize: this.formatBytes(totalSize),
      usedSize: this.formatBytes(usedSize),
      freeSize: this.formatBytes(freeSize),
      fragmentation: ((freeSize / totalSize) * 100).toFixed(2) + '%',
      pageSize: pageSize.page_size,
      pageCount: pageCount.page_count,
      freePages: freePages.freelist_count
    };
  }
  
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}

// Export singleton
export const queryOptimizer = new QueryOptimizer();
export default queryOptimizer;

/**
 * Wrapper for timed query execution
 */
export function timedQuery<T>(
  queryFn: () => T,
  queryDescription: string
): T {
  const start = Date.now();
  try {
    const result = queryFn();
    const duration = Date.now() - start;
    queryOptimizer.logQuery(queryDescription, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    queryOptimizer.logQuery(queryDescription, duration);
    throw error;
  }
}
