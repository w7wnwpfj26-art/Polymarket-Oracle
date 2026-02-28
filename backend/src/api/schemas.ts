/**
 * Zod 校验 Schemas - 所有 API 输入统一校验
 */

import { z } from 'zod';

// ============ 通用 ============

export const idParamSchema = z.object({
  id: z.string().min(1).max(128),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// ============ Config ============

export const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'qwen', 'local']).optional(),
  model: z.string().min(1).max(128).optional(),
  apiKey: z.string().max(256).optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
});

export const riskManagementSchema = z.object({
  maxSemanticRisk: z.number().min(0).max(100).optional(),
  minIrreversibilityScore: z.number().min(0).max(100).optional(),
  maxSingleTradeAmount: z.number().min(0).optional(),
  maxTotalExposure: z.number().min(0).optional(),
  maxDailyLoss: z.number().min(0).optional(),
  stopLossPercentage: z.number().min(0).max(100).optional(),
  requireUnanimousApproval: z.boolean().optional(),
});

export const arbitrageDetectionSchema = z.object({
  minProfitMargin: z.number().min(0).max(100).optional(),
  maxSlippage: z.number().min(0).max(100).optional(),
  includeFees: z.boolean().optional(),
  validityWindowSeconds: z.number().int().min(1).optional(),
});

export const executionConfigSchema = z.object({
  autoExecute: z.boolean().optional(),
  dryRunMode: z.boolean().optional(),
  confirmBeforeExecute: z.boolean().optional(),
  executionDelayMs: z.number().int().min(0).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

export const configUpdateSchema = z.object({
  ai: aiConfigSchema.optional(),
  strategy: z.object({
    riskManagement: riskManagementSchema.optional(),
    arbitrageDetection: arbitrageDetectionSchema.optional(),
    execution: executionConfigSchema.optional(),
  }).optional(),
  agents: z.record(z.object({
    enabled: z.boolean().optional(),
    useAI: z.boolean().optional(),
    vetoPower: z.boolean().optional(),
  })).optional(),
  dataSources: z.object({
    polymarket: z.object({
      enabled: z.boolean().optional(),
      apiBase: z.string().optional(),
      rateLimitPerMinute: z.number().int().min(1).optional(),
    }).optional(),
    oddsApi: z.object({
      enabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      apiBase: z.string().optional(),
    }).optional(),
  }).optional(),
  notifications: z.any().optional(),
});

// ============ Agents ============

export const agentToggleSchema = z.object({
  enabled: z.boolean(),
});

export const agentTestSchema = z.object({
  opportunity: z.any(), // ArbitrageOpportunity - flexible for testing
  context: z.record(z.any()).optional(),
});

// ============ Copy Trading ============

export const traderRegisterSchema = z.object({
  profitShare: z.number().min(0).max(100).optional().default(10),
  minCopyAmount: z.number().min(0).optional().default(10),
  maxCopyAmount: z.number().min(0).optional().default(10000),
});

export const startCopySchema = z.object({
  traderId: z.string().min(1),
  amount: z.number().min(1),
});

// ============ Hedge ============

export const hedgeMarketDataSchema = z.object({
  markets: z.array(z.object({
    source: z.enum(['polymarket', 'traditional']),
    platform: z.string(),
    eventName: z.string(),
    question: z.string(),
    outcomes: z.array(z.object({
      name: z.string(),
      price: z.number().min(0).max(1),
      impliedProbability: z.number().min(0).max(100),
    })),
    timestamp: z.coerce.date(),
    metadata: z.record(z.any()).optional(),
  })),
});

export const hedgeScanSchema = z.object({
  minProfit: z.number().min(0).optional(),
  maxRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  useAI: z.boolean().optional(),
});

export const hedgeCalculateSchema = z.object({
  polymarketPrice: z.number().min(0).max(1),
  traditionalOdds: z.number().min(1),
  investment: z.number().min(1),
  polySide: z.enum(['YES', 'NO']),
});

// ============ Sentiment ============

export const sentimentMarketsSchema = z.object({
  markets: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
  })).min(1).max(50),
});

export const sentimentAnalyzeSchema = z.object({
  text: z.string().min(1).max(10000),
});

export const sentimentConfigureSchema = z.object({
  twitterApiKey: z.string().optional(),
  redditClientId: z.string().optional(),
  redditClientSecret: z.string().optional(),
  newsApiKey: z.string().optional(),
});

// ============ Prediction ============

export const predictionAISchema = z.object({
  marketId: z.string().min(1),
  question: z.string().min(1),
  currentPrice: z.number().min(0).max(1),
  relatedNews: z.array(z.string()).optional(),
});

export const predictionMarketsSchema = z.object({
  markets: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    price: z.number().min(0).max(1),
  })).min(1).max(50),
});

export const priceRecordSchema = z.object({
  marketId: z.string().min(1),
  price: z.number().min(0).max(1),
  volume: z.number().min(0).optional().default(0),
});

// ============ Telegram ============

export const telegramConfigureSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
  enabled: z.boolean(),
});

export const telegramTestSchema = z.object({
  chatId: z.string().optional(),
  message: z.string().max(4096).optional(),
});

export const telegramPushSchema = z.object({
  id: z.string(),
  type: z.string(),
  question: z.string(),
  expectedProfit: z.number(),
  expectedProfitPercent: z.number(),
  worstCaseLoss: z.number(),
  platforms: z.any(),
  confidence: z.number().min(0).max(100),
  validUntil: z.string(),
});

// ============ 校验辅助 ============

export function validateBody<T>(schema: z.ZodType<T>) {
  return async (body: unknown): Promise<{ success: true; data: T } | { success: false; error: string }> => {
    try {
      const data = schema.parse(body);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') };
      }
      return { success: false, error: 'Invalid request body' };
    }
  };
}
