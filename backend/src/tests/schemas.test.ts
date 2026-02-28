/**
 * Zod Validation Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hedgeCalculateSchema,
  startCopySchema,
  sentimentAnalyzeSchema,
  predictionAISchema,
  priceRecordSchema,
  telegramConfigureSchema,
  configUpdateSchema,
  agentToggleSchema,
} from '../api/schemas';

describe('Zod Schemas', () => {
  describe('hedgeCalculateSchema', () => {
    it('should accept valid input', () => {
      const result = hedgeCalculateSchema.safeParse({
        polymarketPrice: 0.45,
        traditionalOdds: 2.5,
        investment: 1000,
        polySide: 'YES',
      });
      expect(result.success).toBe(true);
    });

    it('should reject price out of range', () => {
      const result = hedgeCalculateSchema.safeParse({
        polymarketPrice: 1.5, // > 1
        traditionalOdds: 2.5,
        investment: 1000,
        polySide: 'YES',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid side', () => {
      const result = hedgeCalculateSchema.safeParse({
        polymarketPrice: 0.5,
        traditionalOdds: 2.5,
        investment: 1000,
        polySide: 'MAYBE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('startCopySchema', () => {
    it('should accept valid input', () => {
      const result = startCopySchema.safeParse({
        traderId: 'trader-123',
        amount: 500,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing traderId', () => {
      const result = startCopySchema.safeParse({ amount: 500 });
      expect(result.success).toBe(false);
    });

    it('should reject amount < 1', () => {
      const result = startCopySchema.safeParse({ traderId: 'x', amount: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('sentimentAnalyzeSchema', () => {
    it('should accept valid text', () => {
      const result = sentimentAnalyzeSchema.safeParse({ text: 'Bitcoin is going up!' });
      expect(result.success).toBe(true);
    });

    it('should reject empty text', () => {
      const result = sentimentAnalyzeSchema.safeParse({ text: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('predictionAISchema', () => {
    it('should accept valid prediction request', () => {
      const result = predictionAISchema.safeParse({
        marketId: 'market-1',
        question: 'Will BTC reach 100k?',
        currentPrice: 0.65,
        relatedNews: ['BTC ETF approved'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject price > 1', () => {
      const result = predictionAISchema.safeParse({
        marketId: 'm1',
        question: 'test',
        currentPrice: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('priceRecordSchema', () => {
    it('should accept and default volume to 0', () => {
      const result = priceRecordSchema.safeParse({
        marketId: 'market-1',
        price: 0.5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(0);
      }
    });
  });

  describe('telegramConfigureSchema', () => {
    it('should accept valid config', () => {
      const result = telegramConfigureSchema.safeParse({
        botToken: '123456:ABC-DEF',
        chatId: '-1001234567',
        enabled: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const result = telegramConfigureSchema.safeParse({ enabled: true });
      expect(result.success).toBe(false);
    });
  });

  describe('configUpdateSchema', () => {
    it('should accept partial config update', () => {
      const result = configUpdateSchema.safeParse({
        ai: { temperature: 0.5 },
      });
      expect(result.success).toBe(true);
    });

    it('should reject temperature > 2', () => {
      const result = configUpdateSchema.safeParse({
        ai: { temperature: 3 },
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty object', () => {
      const result = configUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('agentToggleSchema', () => {
    it('should accept boolean enabled', () => {
      expect(agentToggleSchema.safeParse({ enabled: true }).success).toBe(true);
      expect(agentToggleSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    it('should reject non-boolean', () => {
      expect(agentToggleSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
    });
  });
});
