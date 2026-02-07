/**
 * Database Repository - CRUD Operations
 */

import { db, schema } from './index';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import type { 
  ArbitrageOpportunity, 
  ExecutionPlan as ExecutionPlanType,
  AgentResponse,
  Market as MarketType 
} from '../core/types';

const { 
  markets, 
  opportunities, 
  executionPlans, 
  trades, 
  agentDecisions, 
  systemLogs, 
  dailyStats 
} = schema;

// ============ Markets ============

export async function saveMarket(market: MarketType) {
  const now = new Date().toISOString();
  await db.insert(markets).values({
    id: market.id,
    question: market.question,
    description: market.description,
    source: market.source,
    outcomesJson: JSON.stringify(market.outcomes),
    volume24h: market.volume24h,
    liquidity: market.liquidity,
    endDate: market.endDate,
    tags: market.tags?.join(','),
    createdAt: market.createdAt || now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: markets.id,
    set: {
      outcomesJson: JSON.stringify(market.outcomes),
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      updatedAt: now,
    },
  });
}

export async function getMarkets(limit = 100) {
  return db.select().from(markets).orderBy(desc(markets.updatedAt)).limit(limit);
}

// ============ Opportunities ============

export async function saveOpportunity(opp: ArbitrageOpportunity) {
  await db.insert(opportunities).values({
    id: opp.id,
    type: opp.type,
    marketsJson: JSON.stringify(opp.markets),
    positionsJson: JSON.stringify(opp.positions),
    expectedProfit: opp.expectedProfit,
    expectedProfitPercent: opp.expectedProfitPercent,
    worstCaseLoss: opp.worstCaseLoss,
    guaranteedProfit: opp.guaranteedProfit,
    confidence: opp.confidence,
    status: 'PENDING',
    validUntil: opp.validUntil,
    createdAt: opp.createdAt,
  }).onConflictDoNothing();
}

export async function getOpportunities(status?: string, limit = 50) {
  let query = db.select().from(opportunities).orderBy(desc(opportunities.createdAt)).limit(limit);
  
  if (status) {
    return db.select()
      .from(opportunities)
      .where(eq(opportunities.status, status))
      .orderBy(desc(opportunities.createdAt))
      .limit(limit);
  }
  
  return query;
}

export async function updateOpportunityStatus(id: string, status: string) {
  await db.update(opportunities)
    .set({ status })
    .where(eq(opportunities.id, id));
}

// ============ Execution Plans ============

export async function saveExecutionPlan(plan: ExecutionPlanType) {
  const now = new Date().toISOString();
  
  // Save execution plan
  await db.insert(executionPlans).values({
    id: plan.id,
    opportunityId: plan.opportunity.id,
    finalDecision: plan.finalDecision,
    unanimousApproval: plan.unanimousApproval,
    agentResponsesJson: JSON.stringify(plan.agentResponses),
    totalCapitalRequired: plan.totalCapitalRequired,
    expectedReturn: plan.expectedReturn,
    maxLoss: plan.maxLoss,
    executionStepsJson: JSON.stringify(plan.executionSteps),
    createdAt: plan.createdAt || now,
    executedAt: plan.finalDecision === 'EXECUTE' ? now : null,
  });

  // Save individual agent decisions
  for (const response of plan.agentResponses) {
    await db.insert(agentDecisions).values({
      id: crypto.randomUUID(),
      executionPlanId: plan.id,
      agentId: response.agentId,
      agentName: response.agentName,
      decision: response.decision,
      confidence: response.confidence,
      reasoning: response.reasoning,
      warningsJson: JSON.stringify(response.warnings),
      metadataJson: JSON.stringify(response.metadata),
      processingTimeMs: response.processingTimeMs,
      createdAt: response.timestamp,
    });
  }

  // Update opportunity status
  await updateOpportunityStatus(
    plan.opportunity.id, 
    plan.finalDecision === 'EXECUTE' ? 'EXECUTED' : 'ANALYZED'
  );
}

export async function getExecutionHistory(limit = 100) {
  return db.select()
    .from(executionPlans)
    .orderBy(desc(executionPlans.createdAt))
    .limit(limit);
}

export async function getExecutionPlanById(id: string) {
  const results = await db.select()
    .from(executionPlans)
    .where(eq(executionPlans.id, id))
    .limit(1);
  return results[0] || null;
}

// ============ Trades ============

export async function saveTrade(trade: {
  executionPlanId?: string;
  platform: string;
  marketId: string;
  side: string;
  size: number;
  price: number;
  orderId?: string;
  txHash?: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(trades).values({
    id,
    executionPlanId: trade.executionPlanId,
    platform: trade.platform,
    marketId: trade.marketId,
    side: trade.side,
    size: trade.size,
    price: trade.price,
    status: 'PENDING',
    orderId: trade.orderId,
    txHash: trade.txHash,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateTradeStatus(
  id: string, 
  status: string, 
  details?: { orderId?: string; txHash?: string; errorMessage?: string }
) {
  await db.update(trades)
    .set({
      status,
      orderId: details?.orderId,
      txHash: details?.txHash,
      errorMessage: details?.errorMessage,
      filledAt: status === 'FILLED' ? new Date().toISOString() : undefined,
    })
    .where(eq(trades.id, id));
}

export async function getTradesByPlan(executionPlanId: string) {
  return db.select()
    .from(trades)
    .where(eq(trades.executionPlanId, executionPlanId));
}

// ============ System Logs ============

export async function log(
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
  category: string,
  message: string,
  data?: Record<string, any>
) {
  await db.insert(systemLogs).values({
    level,
    category,
    message,
    dataJson: data ? JSON.stringify(data) : null,
    createdAt: new Date().toISOString(),
  });
}

export async function getLogs(options: {
  level?: string;
  category?: string;
  limit?: number;
  since?: string;
} = {}) {
  const { level, category, limit = 100, since } = options;
  
  let query = db.select().from(systemLogs);
  
  const conditions = [];
  if (level) conditions.push(eq(systemLogs.level, level));
  if (category) conditions.push(eq(systemLogs.category, category));
  if (since) conditions.push(gte(systemLogs.createdAt, since));
  
  if (conditions.length > 0) {
    return db.select()
      .from(systemLogs)
      .where(and(...conditions))
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit);
  }
  
  return db.select()
    .from(systemLogs)
    .orderBy(desc(systemLogs.createdAt))
    .limit(limit);
}

// ============ Daily Stats ============

export async function updateDailyStats(updates: {
  marketsScanned?: number;
  opportunitiesFound?: number;
  opportunitiesExecuted?: number;
  profit?: number;
  loss?: number;
}) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  
  // Get or create today's stats
  const existing = await db.select()
    .from(dailyStats)
    .where(eq(dailyStats.date, today))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(dailyStats).values({
      id: today,
      date: today,
      marketsScanned: updates.marketsScanned || 0,
      opportunitiesFound: updates.opportunitiesFound || 0,
      opportunitiesExecuted: updates.opportunitiesExecuted || 0,
      totalProfit: updates.profit || 0,
      totalLoss: updates.loss || 0,
      netProfit: (updates.profit || 0) - (updates.loss || 0),
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const current = existing[0];
    await db.update(dailyStats)
      .set({
        marketsScanned: (current.marketsScanned || 0) + (updates.marketsScanned || 0),
        opportunitiesFound: (current.opportunitiesFound || 0) + (updates.opportunitiesFound || 0),
        opportunitiesExecuted: (current.opportunitiesExecuted || 0) + (updates.opportunitiesExecuted || 0),
        totalProfit: (current.totalProfit || 0) + (updates.profit || 0),
        totalLoss: (current.totalLoss || 0) + (updates.loss || 0),
        netProfit: ((current.totalProfit || 0) + (updates.profit || 0)) - 
                   ((current.totalLoss || 0) + (updates.loss || 0)),
        updatedAt: now,
      })
      .where(eq(dailyStats.date, today));
  }
}

export async function getDailyStats(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return db.select()
    .from(dailyStats)
    .where(gte(dailyStats.date, since.toISOString().split('T')[0]))
    .orderBy(desc(dailyStats.date));
}

// ============ Summary Stats ============

export async function getSummaryStats() {
  const [oppCount] = await db.select({ count: sql<number>`count(*)` }).from(opportunities);
  const [planCount] = await db.select({ count: sql<number>`count(*)` }).from(executionPlans);
  const [tradeCount] = await db.select({ count: sql<number>`count(*)` }).from(trades);
  
  const todayStats = await getDailyStats(1);
  const weekStats = await getDailyStats(7);
  
  return {
    totalOpportunities: oppCount?.count || 0,
    totalPlans: planCount?.count || 0,
    totalTrades: tradeCount?.count || 0,
    todayStats: todayStats[0] || null,
    weeklyProfit: weekStats.reduce((sum, s) => sum + (s.netProfit || 0), 0),
  };
}
