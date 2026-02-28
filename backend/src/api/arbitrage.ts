/**
 * Arbitrage API Routes
 */

import { Hono } from 'hono';
import type { ArbitrageOpportunity, ApiResponse, ExecutionPlan } from '../core/types';
import { ArbitrageDetector } from '../services/arbitrageDetector';
import { OrchestrationService } from '../services/orchestrator';
import { saveOpportunity, getOpportunities } from '../db/repository';
import { cacheService } from '../services/cache';
import { idParamSchema } from './schemas';

export const arbitrageRoutes = new Hono();

const detector = new ArbitrageDetector();
const orchestrator = new OrchestrationService();

// In-memory cache for recent scan results (merged with DB)
let recentOpportunities: ArbitrageOpportunity[] = [];

async function getAllOpportunities(): Promise<ArbitrageOpportunity[]> {
  const dbRows = await getOpportunities(undefined, 100);
  const fromDb = dbRows.map(row => ({
    id: row.id,
    type: row.type as ArbitrageOpportunity['type'],
    markets: JSON.parse(row.marketsJson),
    positions: JSON.parse(row.positionsJson),
    expectedProfit: row.expectedProfit,
    expectedProfitPercent: row.expectedProfitPercent,
    worstCaseLoss: row.worstCaseLoss,
    guaranteedProfit: row.guaranteedProfit ?? 0,
    confidence: row.confidence,
    validUntil: row.validUntil ?? undefined,
    createdAt: row.createdAt,
  })) as ArbitrageOpportunity[];
  const merged = [...recentOpportunities];
  for (const o of fromDb) {
    if (!merged.some(m => m.id === o.id)) merged.push(o);
  }
  merged.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  return merged.slice(0, 100);
}

// Get all detected opportunities (from DB + recent)
arbitrageRoutes.get('/opportunities', async (c) => {
  const start = Date.now();
  try {
    const opportunities = await getAllOpportunities();
    return c.json<ApiResponse<ArbitrageOpportunity[]>>({
      success: true,
      data: opportunities,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
  } catch (err) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: (err as Error).message },
      meta: { timestamp: new Date().toISOString(), requestId: crypto.randomUUID(), processingTimeMs: Date.now() - start },
    }, 500);
  }
});

// Scan for new opportunities
arbitrageRoutes.post('/scan', async (c) => {
  const start = Date.now();
  
  try {
    const cached = await cacheService.getCachedOpportunities();
    if (cached && cached.length > 0) {
      recentOpportunities = [...cached, ...recentOpportunities].slice(0, 100);
      return c.json<ApiResponse<{ found: number; opportunities: ArbitrageOpportunity[] }>>({
        success: true,
        data: { found: cached.length, opportunities: cached },
        meta: { timestamp: new Date().toISOString(), requestId: crypto.randomUUID(), processingTimeMs: Date.now() - start },
      });
    }

    const newOpportunities = await detector.scan();
    for (const o of newOpportunities) {
      try {
        await saveOpportunity({ ...o, createdAt: o.createdAt || new Date().toISOString() });
      } catch {
        // Ignore duplicate key
      }
    }
    await cacheService.setOpportunitiesCache(newOpportunities);
    recentOpportunities = [...newOpportunities, ...recentOpportunities].slice(0, 100);
    
    return c.json<ApiResponse<{ found: number; opportunities: ArbitrageOpportunity[] }>>({
      success: true,
      data: {
        found: newOpportunities.length,
        opportunities: newOpportunities,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SCAN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to scan for opportunities',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Analyze specific opportunity
arbitrageRoutes.post('/analyze/:id', async (c) => {
  const start = Date.now();
  const parseResult = idParamSchema.safeParse({ id: c.req.param('id') });
  if (!parseResult.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid opportunity ID' },
      meta: { timestamp: new Date().toISOString(), requestId: crypto.randomUUID(), processingTimeMs: Date.now() - start },
    }, 400);
  }
  const { id } = parseResult.data;
  const opportunities = await getAllOpportunities();
  const opportunity = opportunities.find(o => o.id === id);
  if (!opportunity) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Opportunity ${id} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 404);
  }
  
  try {
    const plan = await orchestrator.analyze(opportunity);
    
    return c.json<ApiResponse<ExecutionPlan>>({
      success: true,
      data: plan,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze opportunity',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Execute opportunity (requires all agent approvals)
arbitrageRoutes.post('/execute/:id', async (c) => {
  const start = Date.now();
  const parseResult = idParamSchema.safeParse({ id: c.req.param('id') });
  if (!parseResult.success) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid opportunity ID' },
      meta: { timestamp: new Date().toISOString(), requestId: crypto.randomUUID(), processingTimeMs: Date.now() - start },
    }, 400);
  }
  const { id } = parseResult.data;
  const opportunities = await getAllOpportunities();
  const opportunity = opportunities.find(o => o.id === id);
  if (!opportunity) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Opportunity ${id} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 404);
  }
  
  try {
    const result = await orchestrator.execute(opportunity);
    
    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to execute opportunity',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get execution history
arbitrageRoutes.get('/history', async (c) => {
  const start = Date.now();
  
  const history = orchestrator.getHistory();
  
  return c.json<ApiResponse<typeof history>>({
    success: true,
    data: history,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});
