/**
 * Arbitrage API Routes
 */

import { Hono } from 'hono';
import type { ArbitrageOpportunity, ApiResponse, ExecutionPlan } from '../core/types';
import { ArbitrageDetector } from '../services/arbitrageDetector';
import { OrchestrationService } from '../services/orchestrator';

export const arbitrageRoutes = new Hono();

const detector = new ArbitrageDetector();
const orchestrator = new OrchestrationService();

// Store for opportunities (in production, use a database)
let opportunities: ArbitrageOpportunity[] = [];

// Get all detected opportunities
arbitrageRoutes.get('/opportunities', async (c) => {
  const start = Date.now();
  
  return c.json<ApiResponse<ArbitrageOpportunity[]>>({
    success: true,
    data: opportunities,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Scan for new opportunities
arbitrageRoutes.post('/scan', async (c) => {
  const start = Date.now();
  
  try {
    const newOpportunities = await detector.scan();
    opportunities = [...newOpportunities, ...opportunities].slice(0, 100);
    
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
  const id = c.req.param('id');
  
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
  const id = c.req.param('id');
  
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
