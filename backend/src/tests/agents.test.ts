/**
 * Agent Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { ArbitrageAgent } from '../agents/arbitrageAgent';
import { IrreversibilityVerifier } from '../agents/irreversibilityVerifier';
import { NonTradeAgent } from '../agents/nonTradeAgent';
import type { ArbitrageOpportunity, Market } from '../core/types';

function createTestMarket(overrides: Partial<Market> = {}): Market {
  const now = new Date().toISOString();
  return {
    id: 'test-market',
    question: 'Will BTC reach $100k by end of 2026?',
    description: 'This market resolves YES if BTC reaches $100k.',
    source: 'polymarket',
    outcomes: [
      { name: 'YES', price: 0.45, side: 'YES', volume: 50000 },
      { name: 'NO', price: 0.50, side: 'NO', volume: 40000 },
    ],
    volume24h: 100000,
    liquidity: 50000,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['crypto'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTestOpportunity(overrides: Partial<ArbitrageOpportunity> = {}): ArbitrageOpportunity {
  return {
    id: 'test-opp-1',
    type: 'DUTCH_BOOK',
    markets: {
      polymarket: createTestMarket(),
    },
    positions: [
      { market: 'test-market', side: 'YES', size: 500, price: 0.45, expectedReturn: 1111 },
      { market: 'test-market', side: 'NO', size: 500, price: 0.50, expectedReturn: 1000 },
    ],
    expectedProfit: 50,
    expectedProfitPercent: 5,
    worstCaseLoss: 0,
    guaranteedProfit: 50,
    confidence: 85,
    validUntil: new Date(Date.now() + 60000).toISOString(),
    riskFactors: ['Liquidity may be insufficient'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ArbitrageAgent', () => {
  const agent = new ArbitrageAgent();

  it('should approve valid Dutch Book opportunity', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity(),
      previousResponses: [],
    });
    expect(result.agentId).toBe('arbitrage');
    expect(result.decision).toBe('APPROVE');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should reject opportunity with no type', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity({ type: 'NONE' }),
      previousResponses: [],
    });
    expect(result.decision).toBe('REJECT');
  });

  it('should penalize low profit margin', async () => {
    const lowProfit = await agent.run({
      opportunity: createTestOpportunity({ expectedProfitPercent: 0.1 }),
      previousResponses: [],
    });
    const highProfit = await agent.run({
      opportunity: createTestOpportunity({ expectedProfitPercent: 5 }),
      previousResponses: [],
    });
    expect(lowProfit.confidence).toBeLessThan(highProfit.confidence);
  });

  it('should penalize worst case loss > 0', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity({ worstCaseLoss: 100 }),
      previousResponses: [],
    });
    // With worst case loss > 0, should not be APPROVE
    expect(result.decision).not.toBe('APPROVE');
  });
});

describe('IrreversibilityVerifier', () => {
  const agent = new IrreversibilityVerifier();

  it('should score higher for past events', async () => {
    const pastMarket = createTestMarket({
      endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      question: 'Was the election result confirmed officially?',
    });
    const futureMarket = createTestMarket({
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      question: 'Will the election be held next year?',
    });

    const pastResult = await agent.run({
      opportunity: createTestOpportunity({ markets: { polymarket: pastMarket } }),
      previousResponses: [],
    });
    const futureResult = await agent.run({
      opportunity: createTestOpportunity({ markets: { polymarket: futureMarket } }),
      previousResponses: [],
    });

    expect(pastResult.confidence).toBeGreaterThan(futureResult.confidence);
  });

  it('should detect reversibility indicators', async () => {
    const market = createTestMarket({
      question: 'Will the preliminary unconfirmed report be validated?',
    });
    const result = await agent.run({
      opportunity: createTestOpportunity({ markets: { polymarket: market } }),
      previousResponses: [],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('NonTradeAgent', () => {
  const agent = new NonTradeAgent();

  it('should be skeptical of high profit opportunities', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity({ expectedProfitPercent: 25 }),
      previousResponses: [],
    });
    expect(result.decision).toBe('REJECT');
    expect(result.warnings.some(w => w.includes('Suspiciously high'))).toBe(true);
  });

  it('should approve reasonable opportunities with no red flags', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity({ expectedProfitPercent: 2 }),
      previousResponses: [],
    });
    expect(result.decision).toBe('APPROVE');
  });

  it('should increase skepticism when previous agents rejected', async () => {
    const result = await agent.run({
      opportunity: createTestOpportunity(),
      previousResponses: [
        {
          agentId: 'semantic-judge',
          agentName: 'Semantic Judge',
          decision: 'REJECT',
          confidence: 80,
          reasoning: 'Semantic risk detected',
          warnings: ['Ambiguous language'],
          metadata: {},
          timestamp: new Date().toISOString(),
          processingTimeMs: 100,
        },
      ],
    });
    expect(result.confidence).toBeLessThan(80);
  });
});
