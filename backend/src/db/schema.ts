/**
 * Database Schema - Drizzle ORM
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 市场表
export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  description: text('description'),
  source: text('source').notNull(), // polymarket, odds_api
  outcomesJson: text('outcomes_json'), // JSON string
  volume24h: real('volume_24h').default(0),
  liquidity: real('liquidity').default(0),
  endDate: text('end_date'),
  tags: text('tags'), // comma-separated
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 套利机会表
export const opportunities = sqliteTable('opportunities', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // DUTCH_BOOK, CROSS_PLATFORM, HEDGE_ARB
  marketsJson: text('markets_json').notNull(), // JSON string
  positionsJson: text('positions_json').notNull(), // JSON string
  expectedProfit: real('expected_profit').notNull(),
  expectedProfitPercent: real('expected_profit_percent').notNull(),
  worstCaseLoss: real('worst_case_loss').notNull(),
  guaranteedProfit: real('guaranteed_profit'),
  confidence: integer('confidence').notNull(),
  status: text('status').default('PENDING'), // PENDING, ANALYZED, EXECUTED, EXPIRED
  validUntil: text('valid_until'),
  createdAt: text('created_at').notNull(),
});

// 执行计划表
export const executionPlans = sqliteTable('execution_plans', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),
  finalDecision: text('final_decision').notNull(), // EXECUTE, HOLD, HALT
  unanimousApproval: integer('unanimous_approval', { mode: 'boolean' }).default(false),
  agentResponsesJson: text('agent_responses_json'), // JSON string
  totalCapitalRequired: real('total_capital_required'),
  expectedReturn: real('expected_return'),
  maxLoss: real('max_loss'),
  executionStepsJson: text('execution_steps_json'), // JSON string
  createdAt: text('created_at').notNull(),
  executedAt: text('executed_at'),
});

// 交易记录表
export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  executionPlanId: text('execution_plan_id'),
  platform: text('platform').notNull(), // polymarket, pinnacle, etc.
  marketId: text('market_id').notNull(),
  side: text('side').notNull(), // YES, NO, BUY, SELL
  size: real('size').notNull(),
  price: real('price').notNull(),
  status: text('status').default('PENDING'), // PENDING, FILLED, CANCELLED, FAILED
  orderId: text('order_id'), // Platform order ID
  txHash: text('tx_hash'), // Blockchain transaction hash
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  filledAt: text('filled_at'),
});

// 代理决策记录表
export const agentDecisions = sqliteTable('agent_decisions', {
  id: text('id').primaryKey(),
  executionPlanId: text('execution_plan_id').notNull(),
  agentId: text('agent_id').notNull(),
  agentName: text('agent_name').notNull(),
  decision: text('decision').notNull(), // APPROVE, REJECT, ABSTAIN
  confidence: integer('confidence').notNull(),
  reasoning: text('reasoning'),
  warningsJson: text('warnings_json'), // JSON array
  metadataJson: text('metadata_json'), // JSON object
  processingTimeMs: integer('processing_time_ms'),
  createdAt: text('created_at').notNull(),
});

// 系统配置表
export const systemConfig = sqliteTable('system_config', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string
  updatedAt: text('updated_at').notNull(),
});

// 系统日志表
export const systemLogs = sqliteTable('system_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level').notNull(), // INFO, WARN, ERROR, CRITICAL
  category: text('category').notNull(), // system, agent, trade, api
  message: text('message').notNull(),
  dataJson: text('data_json'), // JSON object
  createdAt: text('created_at').notNull(),
});

// 每日统计表
export const dailyStats = sqliteTable('daily_stats', {
  id: text('id').primaryKey(), // YYYY-MM-DD
  date: text('date').notNull().unique(),
  marketsScanned: integer('markets_scanned').default(0),
  opportunitiesFound: integer('opportunities_found').default(0),
  opportunitiesExecuted: integer('opportunities_executed').default(0),
  totalProfit: real('total_profit').default(0),
  totalLoss: real('total_loss').default(0),
  netProfit: real('net_profit').default(0),
  capitalStart: real('capital_start').default(0),
  capitalEnd: real('capital_end').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 类型导出
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type ExecutionPlan = typeof executionPlans.$inferSelect;
export type NewExecutionPlan = typeof executionPlans.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type AgentDecision = typeof agentDecisions.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
