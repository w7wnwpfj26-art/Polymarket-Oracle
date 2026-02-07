/**
 * Markets API Routes
 */

import { Hono } from 'hono';
import type { Market, ApiResponse, PaginatedResponse } from '../core/types';
import { PolymarketService } from '../services/polymarket';
import { OddsApiService } from '../services/oddsApi';

export const marketRoutes = new Hono();

const polymarket = new PolymarketService();
const oddsApi = new OddsApiService();

// Get all markets from Polymarket
marketRoutes.get('/', async (c) => {
  const start = Date.now();
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const tag = c.req.query('tag');
  
  try {
    const markets = await polymarket.getMarkets({ page, pageSize, tag });
    
    return c.json<PaginatedResponse<Market>>({
      success: true,
      data: markets.data,
      pagination: {
        page,
        pageSize,
        totalItems: markets.total,
        totalPages: Math.ceil(markets.total / pageSize),
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
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch markets',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get single market by ID
marketRoutes.get('/:id', async (c) => {
  const start = Date.now();
  const id = c.req.param('id');
  
  try {
    const market = await polymarket.getMarketById(id);
    
    if (!market) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Market ${id} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTimeMs: Date.now() - start,
        },
      }, 404);
    }
    
    return c.json<ApiResponse<Market>>({
      success: true,
      data: market,
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
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch market',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Get traditional betting odds
marketRoutes.get('/odds/:sport', async (c) => {
  const start = Date.now();
  const sport = c.req.param('sport');
  
  try {
    const odds = await oddsApi.getOdds(sport);
    
    return c.json<ApiResponse<typeof odds>>({
      success: true,
      data: odds,
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
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch odds',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});

// Scan for matching markets
marketRoutes.post('/scan', async (c) => {
  const start = Date.now();
  
  try {
    const [polymarketData, oddsData] = await Promise.all([
      polymarket.getMarkets({ page: 1, pageSize: 50 }),
      oddsApi.getAllOdds(),
    ]);
    
    return c.json<ApiResponse<{ polymarket: number; odds: number }>>({
      success: true,
      data: {
        polymarket: polymarketData.total,
        odds: oddsData.length,
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
        message: error instanceof Error ? error.message : 'Failed to scan markets',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 500);
  }
});
