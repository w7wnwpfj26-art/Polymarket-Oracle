/**
 * 传统博彩网站配置持久化
 * 保存和加载网站配置到 SQLite
 */

import { getDb } from './index';
import logger from '../utils/logger';

// ============ 类型定义 ============

export interface BettingSiteRecord {
  id: number;
  name: string;
  url: string;
  username: string;
  password: string; // 加密存储
  template: string;
  customSelectors: string; // JSON 字符串
  twoFactorType: string | null;
  twoFactorSecret: string | null;
  proxyServer: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OddsHistoryRecord {
  id: number;
  siteName: string;
  eventName: string;
  market: string;
  selection: string;
  odds: number;
  timestamp: string;
}

// ============ Repository ============

class BettingSiteRepository {
  /**
   * 初始化表结构
   */
  async initTables(): Promise<void> {
    const db = getDb();
    
    // 博彩网站配置表
    db.exec(`
      CREATE TABLE IF NOT EXISTS betting_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        template TEXT DEFAULT 'sportsbook',
        custom_selectors TEXT DEFAULT '{}',
        two_factor_type TEXT,
        two_factor_secret TEXT,
        proxy_server TEXT,
        is_active INTEGER DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 赔率历史表
    db.exec(`
      CREATE TABLE IF NOT EXISTS odds_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_name TEXT NOT NULL,
        event_name TEXT NOT NULL,
        market TEXT,
        selection TEXT,
        odds REAL NOT NULL,
        timestamp TEXT DEFAULT (datetime('now'))
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_odds_history_site 
      ON odds_history(site_name, timestamp)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_odds_history_event 
      ON odds_history(event_name, timestamp)
    `);

    logger.system.info('Betting site tables initialized');
  }

  /**
   * 保存网站配置
   */
  async saveSite(site: Omit<BettingSiteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const db = getDb();
    
    // 简单加密密码（生产环境应使用更安全的加密）
    const encryptedPassword = Buffer.from(site.password).toString('base64');

    const stmt = db.prepare(`
      INSERT INTO betting_sites (
        name, url, username, password, template, custom_selectors,
        two_factor_type, two_factor_secret, proxy_server, is_active, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        url = excluded.url,
        username = excluded.username,
        password = excluded.password,
        template = excluded.template,
        custom_selectors = excluded.custom_selectors,
        two_factor_type = excluded.two_factor_type,
        two_factor_secret = excluded.two_factor_secret,
        proxy_server = excluded.proxy_server,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `);

    const result = stmt.run(
      site.name,
      site.url,
      site.username,
      encryptedPassword,
      site.template,
      site.customSelectors,
      site.twoFactorType,
      site.twoFactorSecret,
      site.proxyServer,
      site.isActive ? 1 : 0,
      site.lastLoginAt
    );

    logger.system.info('Betting site saved', { name: site.name });
    return result.lastInsertRowid as number;
  }

  /**
   * 获取所有网站配置
   */
  async getAllSites(): Promise<BettingSiteRecord[]> {
    const db = getDb();
    
    const stmt = db.prepare(`
      SELECT 
        id, name, url, username, password, template,
        custom_selectors as customSelectors,
        two_factor_type as twoFactorType,
        two_factor_secret as twoFactorSecret,
        proxy_server as proxyServer,
        is_active as isActive,
        last_login_at as lastLoginAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM betting_sites
      WHERE is_active = 1
      ORDER BY name
    `);

    const rows = stmt.all() as any[];

    // 解密密码
    return rows.map(row => ({
      ...row,
      password: Buffer.from(row.password, 'base64').toString('utf-8'),
      isActive: Boolean(row.isActive),
    }));
  }

  /**
   * 获取单个网站配置
   */
  async getSite(name: string): Promise<BettingSiteRecord | null> {
    const db = getDb();
    
    const stmt = db.prepare(`
      SELECT 
        id, name, url, username, password, template,
        custom_selectors as customSelectors,
        two_factor_type as twoFactorType,
        two_factor_secret as twoFactorSecret,
        proxy_server as proxyServer,
        is_active as isActive,
        last_login_at as lastLoginAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM betting_sites
      WHERE name = ?
    `);

    const row = stmt.get(name) as any;

    if (!row) return null;

    return {
      ...row,
      password: Buffer.from(row.password, 'base64').toString('utf-8'),
      isActive: Boolean(row.isActive),
    };
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(name: string): Promise<void> {
    const db = getDb();
    
    const stmt = db.prepare(`
      UPDATE betting_sites
      SET last_login_at = datetime('now'), updated_at = datetime('now')
      WHERE name = ?
    `);

    stmt.run(name);
  }

  /**
   * 删除网站配置（软删除）
   */
  async deleteSite(name: string): Promise<void> {
    const db = getDb();
    
    const stmt = db.prepare(`
      UPDATE betting_sites
      SET is_active = 0, updated_at = datetime('now')
      WHERE name = ?
    `);

    stmt.run(name);
    logger.system.info('Betting site deactivated', { name });
  }

  /**
   * 永久删除网站配置
   */
  async hardDeleteSite(name: string): Promise<void> {
    const db = getDb();
    
    db.prepare(`DELETE FROM betting_sites WHERE name = ?`).run(name);
    db.prepare(`DELETE FROM odds_history WHERE site_name = ?`).run(name);

    logger.system.info('Betting site permanently deleted', { name });
  }

  /**
   * 保存赔率历史
   */
  async saveOdds(odds: Omit<OddsHistoryRecord, 'id' | 'timestamp'>[]): Promise<void> {
    if (odds.length === 0) return;

    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT INTO odds_history (site_name, event_name, market, selection, odds)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: typeof odds) => {
      for (const odd of items) {
        stmt.run(odd.siteName, odd.eventName, odd.market, odd.selection, odd.odds);
      }
    });

    insertMany(odds);
    logger.system.info('Odds history saved', { count: odds.length });
  }

  /**
   * 获取赔率历史
   */
  async getOddsHistory(options: {
    siteName?: string;
    eventName?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<OddsHistoryRecord[]> {
    const db = getDb();
    
    let query = `
      SELECT 
        id, site_name as siteName, event_name as eventName,
        market, selection, odds, timestamp
      FROM odds_history
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.siteName) {
      query += ` AND site_name = ?`;
      params.push(options.siteName);
    }

    if (options.eventName) {
      query += ` AND event_name LIKE ?`;
      params.push(`%${options.eventName}%`);
    }

    if (options.startTime) {
      query += ` AND timestamp >= ?`;
      params.push(options.startTime);
    }

    if (options.endTime) {
      query += ` AND timestamp <= ?`;
      params.push(options.endTime);
    }

    query += ` ORDER BY timestamp DESC`;

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as OddsHistoryRecord[];
  }

  /**
   * 获取赔率变化统计
   */
  async getOddsStats(siteName: string, eventName: string): Promise<{
    min: number;
    max: number;
    avg: number;
    count: number;
    firstOdds: number;
    lastOdds: number;
    change: number;
  } | null> {
    const db = getDb();
    
    const stats = db.prepare(`
      SELECT 
        MIN(odds) as min,
        MAX(odds) as max,
        AVG(odds) as avg,
        COUNT(*) as count
      FROM odds_history
      WHERE site_name = ? AND event_name = ?
    `).get(siteName, eventName) as any;

    if (!stats || stats.count === 0) return null;

    const first = db.prepare(`
      SELECT odds FROM odds_history 
      WHERE site_name = ? AND event_name = ? 
      ORDER BY timestamp ASC LIMIT 1
    `).get(siteName, eventName) as { odds: number } | undefined;

    const last = db.prepare(`
      SELECT odds FROM odds_history 
      WHERE site_name = ? AND event_name = ? 
      ORDER BY timestamp DESC LIMIT 1
    `).get(siteName, eventName) as { odds: number } | undefined;

    const firstOdds = first?.odds || 0;
    const lastOdds = last?.odds || 0;

    return {
      min: stats.min,
      max: stats.max,
      avg: stats.avg,
      count: stats.count,
      firstOdds,
      lastOdds,
      change: firstOdds > 0 ? ((lastOdds - firstOdds) / firstOdds) * 100 : 0,
    };
  }

  /**
   * 清理旧的赔率数据
   */
  async cleanupOldOdds(daysToKeep: number = 30): Promise<number> {
    const db = getDb();
    
    const result = db.prepare(`
      DELETE FROM odds_history
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `).run(daysToKeep);

    const deleted = result.changes || 0;
    if (deleted > 0) {
      logger.system.info('Old odds data cleaned up', { deleted, daysToKeep });
    }

    return deleted;
  }
}

// Export singleton
export const bettingSiteRepository = new BettingSiteRepository();
export default bettingSiteRepository;
