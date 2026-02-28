/**
 * Database Connection and Initialization
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

// Database file path
const DB_PATH = process.env.DATABASE_PATH || './data/aegis.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL'); // Better performance
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

/**
 * Get database instance for raw queries
 */
export function getDb() {
  return sqlite;
}

/**
 * Initialize database tables
 */
export async function initializeDatabase() {
  logger.db.info('[DB] Initializing database...');
  
  // Create tables manually (since we're not using migrations for simplicity)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      outcomes_json TEXT,
      volume_24h REAL DEFAULT 0,
      liquidity REAL DEFAULT 0,
      end_date TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      markets_json TEXT NOT NULL,
      positions_json TEXT NOT NULL,
      expected_profit REAL NOT NULL,
      expected_profit_percent REAL NOT NULL,
      worst_case_loss REAL NOT NULL,
      guaranteed_profit REAL,
      confidence INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING',
      valid_until TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_plans (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL,
      final_decision TEXT NOT NULL,
      unanimous_approval INTEGER DEFAULT 0,
      agent_responses_json TEXT,
      total_capital_required REAL,
      expected_return REAL,
      max_loss REAL,
      execution_steps_json TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      execution_plan_id TEXT,
      platform TEXT NOT NULL,
      market_id TEXT NOT NULL,
      side TEXT NOT NULL,
      size REAL NOT NULL,
      price REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      order_id TEXT,
      tx_hash TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      filled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_decisions (
      id TEXT PRIMARY KEY,
      execution_plan_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      reasoning TEXT,
      warnings_json TEXT,
      metadata_json TEXT,
      processing_time_ms INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      data_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      markets_scanned INTEGER DEFAULT 0,
      opportunities_found INTEGER DEFAULT 0,
      opportunities_executed INTEGER DEFAULT 0,
      total_profit REAL DEFAULT 0,
      total_loss REAL DEFAULT 0,
      net_profit REAL DEFAULT 0,
      capital_start REAL DEFAULT 0,
      capital_end REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      was_correct INTEGER,
      outcome TEXT,
      profit_loss REAL,
      market_question TEXT,
      market_type TEXT,
      context_json TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
    CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_platform ON trades(platform);
    CREATE INDEX IF NOT EXISTS idx_agent_decisions_plan ON agent_decisions(execution_plan_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
    CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_opp ON agent_memory(opportunity_id);
  `);

  logger.db.info('[DB] Database initialized successfully');
  logger.db.info('[DB] Database path: ' + path.resolve(DB_PATH));
}

/**
 * Close database connection
 */
export function closeDatabase() {
  sqlite.close();
  logger.db.info('[DB] Database connection closed');
}

/**
 * Get database stats
 */
export function getDatabaseStats() {
  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[];

  const stats: Record<string, number> = {};
  for (const { name } of tables) {
    const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
    stats[name] = result.count;
  }

  return {
    path: path.resolve(DB_PATH),
    tables: stats,
    totalRecords: Object.values(stats).reduce((a, b) => a + b, 0),
  };
}

export function getDatabase() {
  return db;
}

export { schema };
