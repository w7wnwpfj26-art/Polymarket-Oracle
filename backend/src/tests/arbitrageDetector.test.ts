/**
 * Arbitrage Detector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArbitrageDetector, DutchBookResult } from '../services/arbitrageDetector';
import type { Market } from '../core/types';

describe('ArbitrageDetector', () => {
  let detector: ArbitrageDetector;

  beforeEach(() => {
    detector = new ArbitrageDetector();
  });

  describe('Dutch Book Detection', () => {
    it('should detect Dutch Book when prices sum to less than 1', () => {
      const market: Market = {
        id: 'test-market-1',
        question: 'Will BTC reach $100k?',
        description: 'Test market',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.45 },
          { name: 'NO', price: 0.50 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const result = detector.checkDutchBook(market);
      
      expect(result.hasDutchBook).toBe(true);
      expect(result.impliedProbabilitySum).toBeLessThan(1);
      expect(result.profitMargin).toBeGreaterThan(0);
    });

    it('should not detect Dutch Book when prices sum to 1 or more', () => {
      const market: Market = {
        id: 'test-market-2',
        question: 'Will ETH merge succeed?',
        description: 'Test market',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.55 },
          { name: 'NO', price: 0.50 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const result = detector.checkDutchBook(market);
      
      expect(result.hasDutchBook).toBe(false);
      expect(result.impliedProbabilitySum).toBeGreaterThanOrEqual(1);
    });

    it('should calculate correct profit margin', () => {
      const market: Market = {
        id: 'test-market-3',
        question: 'Test question',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.40 },
          { name: 'NO', price: 0.40 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const result = detector.checkDutchBook(market);
      
      // Sum = 0.80, so profit margin should be (1 - 0.80) / 1 = 0.20 = 20%
      expect(result.profitMargin).toBeCloseTo(0.20, 2);
    });
  });

  describe('Cross Platform Arbitrage', () => {
    it('should detect arbitrage when Polymarket YES + Traditional NO < 1', () => {
      const polymarket: Market = {
        id: 'poly-1',
        question: 'Will X happen?',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.45 },
          { name: 'NO', price: 0.55 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const traditional: Market = {
        id: 'trad-1',
        question: 'Will X happen?',
        description: 'Test',
        source: 'odds_api',
        outcomes: [
          { name: 'YES', price: 0.60 },
          { name: 'NO', price: 0.45 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const result = detector.checkCrossPlatformArbitrage(polymarket, traditional);
      
      // Poly YES (0.45) + Trad NO (0.45) = 0.90 < 1
      expect(result.hasArbitrage).toBe(true);
      expect(result.strategy).toBe('BUY_POLY_YES_SELL_TRAD_NO');
    });

    it('should not detect arbitrage when sum >= 1', () => {
      const polymarket: Market = {
        id: 'poly-2',
        question: 'Will Y happen?',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.55 },
          { name: 'NO', price: 0.50 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const traditional: Market = {
        id: 'trad-2',
        question: 'Will Y happen?',
        description: 'Test',
        source: 'odds_api',
        outcomes: [
          { name: 'YES', price: 0.50 },
          { name: 'NO', price: 0.55 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

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
      const market: Market = {
        id: 'fee-test',
        question: 'Fee test',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.40 },
          { name: 'NO', price: 0.40 },
        ],
        volume24h: 100000,
        liquidity: 50000,
        createdAt: new Date().toISOString(),
      };

      const resultWithoutFees = detector.checkDutchBook(market, { includeFees: false });
      const resultWithFees = detector.checkDutchBook(market, { includeFees: true, feeRate: 0.02 });
      
      expect(resultWithFees.profitMargin).toBeLessThan(resultWithoutFees.profitMargin);
    });
  });

  describe('Confidence Score', () => {
    it('should have higher confidence for higher liquidity', () => {
      const lowLiquidity: Market = {
        id: 'low-liq',
        question: 'Low liquidity',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.40 },
          { name: 'NO', price: 0.40 },
        ],
        volume24h: 1000,
        liquidity: 5000,
        createdAt: new Date().toISOString(),
      };

      const highLiquidity: Market = {
        id: 'high-liq',
        question: 'High liquidity',
        description: 'Test',
        source: 'polymarket',
        outcomes: [
          { name: 'YES', price: 0.40 },
          { name: 'NO', price: 0.40 },
        ],
        volume24h: 500000,
        liquidity: 200000,
        createdAt: new Date().toISOString(),
      };

      const lowResult = detector.checkDutchBook(lowLiquidity);
      const highResult = detector.checkDutchBook(highLiquidity);
      
      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });
  });
});
