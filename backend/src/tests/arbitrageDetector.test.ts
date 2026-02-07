/**
 * Arbitrage Detector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArbitrageDetector, DutchBookResult } from '../services/arbitrageDetector';
import type { Market } from '../core/types';

function marketWithOutcomes(outcomes: { name: string; price: number }[], overrides: Partial<Market> = {}): Market {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'test-id',
    question: overrides.question ?? 'Test',
    description: overrides.description ?? '',
    source: 'polymarket',
    outcomes: outcomes.map(o => ({
      name: o.name,
      price: o.price,
      side: (o.name.toUpperCase() === 'YES' ? 'YES' : 'NO') as 'YES' | 'NO',
      volume: 0,
    })),
    volume24h: 100000,
    liquidity: 50000,
    endDate: now,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ArbitrageDetector', () => {
  let detector: ArbitrageDetector;

  beforeEach(() => {
    detector = new ArbitrageDetector();
  });

  describe('Dutch Book Detection', () => {
    it('should detect Dutch Book when prices sum to less than 1', () => {
      const market = marketWithOutcomes([
        { name: 'YES', price: 0.45 },
        { name: 'NO', price: 0.50 },
      ], { id: 'test-market-1', question: 'Will BTC reach $100k?' });

      const result = detector.checkDutchBook(market);
      
      expect(result.hasDutchBook).toBe(true);
      expect(result.impliedProbabilitySum).toBeLessThan(1);
      expect(result.profitMargin).toBeGreaterThan(0);
    });

    it('should not detect Dutch Book when prices sum to 1 or more', () => {
      const market = marketWithOutcomes([
        { name: 'YES', price: 0.55 },
        { name: 'NO', price: 0.50 },
      ], { id: 'test-market-2', question: 'Will ETH merge succeed?' });

      const result = detector.checkDutchBook(market);
      
      expect(result.hasDutchBook).toBe(false);
      expect(result.impliedProbabilitySum).toBeGreaterThanOrEqual(1);
    });

    it('should calculate correct profit margin', () => {
      const market = marketWithOutcomes([
        { name: 'YES', price: 0.40 },
        { name: 'NO', price: 0.40 },
      ], { id: 'test-market-3' });

      const result = detector.checkDutchBook(market);
      
      // Sum = 0.80, so profit margin should be (1 - 0.80) / 1 = 0.20 = 20%
      expect(result.profitMargin).toBeCloseTo(0.20, 2);
    });
  });

  describe('Cross Platform Arbitrage', () => {
    it('should detect arbitrage when Polymarket YES + Traditional NO < 1', () => {
      const polymarket = marketWithOutcomes(
        [{ name: 'YES', price: 0.45 }, { name: 'NO', price: 0.55 }],
        { id: 'poly-1', question: 'Will X happen?', source: 'polymarket' }
      );
      const traditional = marketWithOutcomes(
        [{ name: 'YES', price: 0.60 }, { name: 'NO', price: 0.45 }],
        { id: 'trad-1', question: 'Will X happen?', source: 'odds_api' }
      );

      const result = detector.checkCrossPlatformArbitrage(polymarket, traditional);
      
      // Poly YES (0.45) + Trad NO (0.45) = 0.90 < 1
      expect(result.hasArbitrage).toBe(true);
      expect(result.strategy).toBe('BUY_POLY_YES_SELL_TRAD_NO');
    });

    it('should not detect arbitrage when sum >= 1', () => {
      const polymarket = marketWithOutcomes(
        [{ name: 'YES', price: 0.55 }, { name: 'NO', price: 0.50 }],
        { id: 'poly-2', source: 'polymarket' }
      );
      const traditional = marketWithOutcomes(
        [{ name: 'YES', price: 0.50 }, { name: 'NO', price: 0.55 }],
        { id: 'trad-2', source: 'odds_api' }
      );

      const result = detector.checkCrossPlatformArbitrage(polymarket, traditional);
      
      expect(result.hasArbitrage).toBe(false);
    });
  });

  describe('Fee Calculation', () => {
    it('should correctly calculate fees', () => {
      const amount = 1000;
      const feeRate = 0.02; // 2%

      const fee = detector.calculateFee(amount, feeRate);
      
      expect(fee).toBe(20);
    });

    it('should reduce profit after fees', () => {
      const market = marketWithOutcomes(
        [{ name: 'YES', price: 0.40 }, { name: 'NO', price: 0.40 }],
        { id: 'fee-test', question: 'Fee test' }
      );

      const resultWithoutFees = detector.checkDutchBook(market, { includeFees: false });
      const resultWithFees = detector.checkDutchBook(market, { includeFees: true, feeRate: 0.02 });
      
      expect(resultWithFees.profitMargin).toBeLessThan(resultWithoutFees.profitMargin);
    });
  });

  describe('Confidence Score', () => {
    it('should have higher confidence for higher liquidity', () => {
      const lowLiquidity = marketWithOutcomes(
        [{ name: 'YES', price: 0.40 }, { name: 'NO', price: 0.40 }],
        { id: 'low-liq', question: 'Low liquidity', volume24h: 1000, liquidity: 5000 }
      );
      const highLiquidity = marketWithOutcomes(
        [{ name: 'YES', price: 0.40 }, { name: 'NO', price: 0.40 }],
        { id: 'high-liq', question: 'High liquidity', volume24h: 500000, liquidity: 200000 }
      );

      const lowResult = detector.checkDutchBook(lowLiquidity);
      const highResult = detector.checkDutchBook(highLiquidity);
      
      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });
  });
});
