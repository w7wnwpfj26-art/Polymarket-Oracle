/**
 * Configuration API Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { SystemConfig, ApiResponse } from '../core/types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { configUpdateSchema } from './schemas';
import logger from '../utils/logger';

// 配置文件路径（config.json 被 gitignore，首次运行可复制 config.json.example）
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, '../../data/config.json');

export const configRoutes = new Hono();

// 默认配置
const defaultConfig: SystemConfig = {
  ai: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.1,
    maxTokens: 4096,
  },
  strategy: {
    riskManagement: {
      maxSemanticRisk: 30,
      minIrreversibilityScore: 80,
      maxSingleTradeAmount: 1000,
      maxTotalExposure: 10000,
      maxDailyLoss: 500,
      stopLossPercentage: 5,
      requireUnanimousApproval: true,
    },
    arbitrageDetection: {
      minProfitMargin: 0.5,
      maxSlippage: 2.0,
      includeFees: true,
      validityWindowSeconds: 60,
    },
    execution: {
      autoExecute: false,
      dryRunMode: true,
      confirmBeforeExecute: true,
      executionDelayMs: 1000,
      maxRetries: 3,
    },
  },
  agents: {
    semanticJudge: { enabled: true, useAI: true, vetoPower: true },
    irreversibilityVerifier: { enabled: true, useAI: true, vetoPower: true },
    arbitrageConstructor: { enabled: true, useAI: false, vetoPower: true },
    nonTradeAgent: { enabled: true, useAI: true, vetoPower: true },
    redTeamSimulator: { enabled: true, useAI: true, vetoPower: true },
    failSafeMonitor: { enabled: true, useAI: false, vetoPower: true },
  },
  dataSources: {
    polymarket: {
      enabled: true,
      apiBase: 'https://gamma-api.polymarket.com',
      clobApi: 'https://clob.polymarket.com',
      rateLimitPerMinute: 60,
      // 交易配置（需要钱包）
      walletAddress: '',
      privateKey: '', // 警告：生产环境请使用安全的密钥管理
      apiKey: '',
      apiSecret: '',
      apiPassphrase: '',
    },
    oddsApi: {
      enabled: true,
      apiKey: '',
      apiBase: 'https://api.the-odds-api.com/v4',
    },
  },
  notifications: {
    enabled: false,
    telegram: { enabled: false, botToken: '', chatId: '' },
    discord: { enabled: false, webhookUrl: '' },
    webhook: { enabled: false, url: '', headers: {} },
    events: {
      opportunity: true,
      trade: true,
      error: true,
      system: true,
      daily_report: false,
    },
  },
};

// 加载配置（从文件或使用默认值）
function loadConfig(): SystemConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(data);
      return deepMerge(defaultConfig, saved);
    }
  } catch (e) {
    logger.system.warn('Failed to load config file, using defaults', { error: e });
  }
  return { ...defaultConfig };
}

// 保存配置到文件
function saveConfig(cfg: SystemConfig): void {
  try {
    const dir = dirname(CONFIG_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    logger.system.info('Config saved successfully', { path: CONFIG_FILE });
  } catch (e) {
    logger.system.error('Failed to save config', { error: e });
  }
}

// 当前配置（启动时从文件加载）
let config: SystemConfig = loadConfig();

// Get current configuration
configRoutes.get('/', async (c) => {
  const start = Date.now();
  
  // Mask sensitive data
  const safeConfig = {
    ...config,
    ai: {
      ...config.ai,
      apiKey: config.ai.apiKey ? '***masked***' : '',
    },
    dataSources: {
      ...config.dataSources,
      oddsApi: {
        ...config.dataSources.oddsApi,
        apiKey: config.dataSources.oddsApi.apiKey ? '***masked***' : '',
      },
    },
    notifications: {
      ...config.notifications,
      telegram: {
        ...config.notifications.telegram,
        botToken: config.notifications.telegram?.botToken ? '***masked***' : '',
      },
      discord: {
        ...config.notifications.discord,
        webhookUrl: config.notifications.discord?.webhookUrl ? '***masked***' : '',
      },
      webhook: {
        ...config.notifications.webhook,
        url: config.notifications.webhook?.url ? '***masked***' : '',
      },
    },
  };
  
  return c.json<ApiResponse<typeof safeConfig>>({
    success: true,
    data: safeConfig,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Update configuration
configRoutes.put('/', async (c) => {
  const start = Date.now();
  
  let body: z.infer<typeof configUpdateSchema>;
  try {
    body = configUpdateSchema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') },
      }, 400);
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    }, 400);
  }
  
  // Deep merge configuration
  config = deepMerge(config, body as Partial<SystemConfig>);
  
  // 持久化到文件
  saveConfig(config);
  
  return c.json<ApiResponse<{ updated: boolean }>>({
    success: true,
    data: { updated: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Update specific section
configRoutes.patch('/:section', async (c) => {
  const start = Date.now();
  const section = c.req.param('section') as keyof SystemConfig;
  const body = await c.req.json();
  
  if (!config[section]) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INVALID_SECTION',
        message: `Configuration section '${section}' not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        processingTimeMs: Date.now() - start,
      },
    }, 400);
  }
  
  (config as any)[section] = deepMerge(config[section] as any, body);
  
  // 持久化到文件
  saveConfig(config);
  
  return c.json<ApiResponse<{ updated: boolean; section: string }>>({
    success: true,
    data: { updated: true, section },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Reset to defaults
configRoutes.post('/reset', async (c) => {
  const start = Date.now();
  
  // Reset to defaults (keeping API keys)
  const savedKeys = {
    aiKey: config.ai.apiKey,
    oddsKey: config.dataSources.oddsApi.apiKey,
  };
  
  // Re-initialize with defaults
  config.strategy = {
    riskManagement: {
      maxSemanticRisk: 30,
      minIrreversibilityScore: 80,
      maxSingleTradeAmount: 1000,
      maxTotalExposure: 10000,
      maxDailyLoss: 500,
      stopLossPercentage: 5,
      requireUnanimousApproval: true,
    },
    arbitrageDetection: {
      minProfitMargin: 0.5,
      maxSlippage: 2.0,
      includeFees: true,
      validityWindowSeconds: 60,
    },
    execution: {
      autoExecute: false,
      dryRunMode: true,
      confirmBeforeExecute: true,
      executionDelayMs: 1000,
      maxRetries: 3,
    },
  };
  
  config.ai.apiKey = savedKeys.aiKey;
  config.dataSources.oddsApi.apiKey = savedKeys.oddsKey;
  
  return c.json<ApiResponse<{ reset: boolean }>>({
    success: true,
    data: { reset: true },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Validate configuration
configRoutes.post('/validate', async (c) => {
  const start = Date.now();
  const body = await c.req.json<Partial<SystemConfig>>();
  
  const errors: string[] = [];
  
  // Validate AI config
  if (body.ai) {
    if (body.ai.temperature && (body.ai.temperature < 0 || body.ai.temperature > 2)) {
      errors.push('AI temperature must be between 0 and 2');
    }
  }
  
  // Validate strategy config
  if (body.strategy?.riskManagement) {
    const rm = body.strategy.riskManagement;
    if (rm.maxSemanticRisk && (rm.maxSemanticRisk < 0 || rm.maxSemanticRisk > 100)) {
      errors.push('Max semantic risk must be between 0 and 100');
    }
    if (rm.minIrreversibilityScore && (rm.minIrreversibilityScore < 0 || rm.minIrreversibilityScore > 100)) {
      errors.push('Min irreversibility score must be between 0 and 100');
    }
  }
  
  return c.json<ApiResponse<{ valid: boolean; errors: string[] }>>({
    success: true,
    data: { valid: errors.length === 0, errors },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      processingTimeMs: Date.now() - start,
    },
  });
});

// Helper: Deep merge objects
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      (output as any)[key] = source[key];
    }
  }
  
  return output;
}

export function getConfig(): SystemConfig {
  return config;
}
