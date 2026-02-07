/**
 * AEGIS Arbitrage System - Core Types
 * 2026 TypeScript 5.6+ with strict typing
 */

// ============================================
// Market & Price Types
// ============================================

export interface Market {
  id: string;
  question: string;
  description: string;
  outcomes: Outcome[];
  volume24h: number;
  liquidity: number;
  endDate: string;
  source: 'polymarket' | 'odds_api' | 'other';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Outcome {
  name: string;
  price: number;           // 0-1 probability
  odds?: number;           // Decimal odds (e.g., 2.5)
  volume: number;
  side: 'YES' | 'NO' | 'DRAW' | string;
}

export interface TraditionalOdds {
  bookmaker: string;
  market: string;
  outcomes: {
    name: string;
    odds: number;
    impliedProbability: number;
  }[];
  timestamp: string;
}

// ============================================
// Agent System Types
// ============================================

export type AgentDecision = 'APPROVE' | 'REJECT' | 'ABSTAIN';
export type SystemDecision = 'EXECUTE' | 'HOLD' | 'HALT';

export interface AgentResponse {
  agentId: string;
  agentName: string;
  decision: AgentDecision;
  confidence: number;        // 0-100
  reasoning: string;
  warnings: string[];
  metadata: Record<string, unknown>;
  timestamp: string;
  processingTimeMs: number;
}

export interface SemanticAnalysis {
  riskScore: number;         // 0-100
  isMachineSafe: boolean;
  ambiguousTerms: string[];
  legalInterpretationRisk: boolean;
  subjectiveLanguage: boolean;
  oracleDisputeRisk: boolean;
  recommendation: 'SAFE' | 'CAUTION' | 'AVOID';
}

export interface IrreversibilityCheck {
  score: number;             // 0-100
  isIrreversible: boolean;
  eventStatus: 'CONFIRMED' | 'PENDING' | 'DISPUTED' | 'UNKNOWN';
  sources: {
    name: string;
    url: string;
    confidence: number;
  }[];
  canBeReversed: boolean;
  reversalRisk: string[];
}

// ============================================
// Arbitrage Types
// ============================================

export type ArbitrageType = 'DUTCH_BOOK' | 'HEDGE_ARB' | 'CROSS_PLATFORM' | 'NONE';

export interface ArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  markets: {
    polymarket: Market;
    traditional?: TraditionalOdds;
  };
  positions: Position[];
  expectedProfit: number;
  expectedProfitPercent: number;
  worstCaseLoss: number;
  guaranteedProfit: number;
  confidence: number;
  validUntil: string;
  riskFactors: string[];
  createdAt: string;
}

export interface Position {
  market: string;
  side: string;
  size: number;
  price: number;
  expectedReturn: number;
}

// ============================================
// Execution Types
// ============================================

export interface ExecutionPlan {
  id: string;
  opportunity: ArbitrageOpportunity;
  agentResponses: AgentResponse[];
  finalDecision: SystemDecision;
  unanimousApproval: boolean;
  totalCapitalRequired: number;
  expectedReturn: number;
  maxLoss: number;
  executionSteps: ExecutionStep[];
  createdAt: string;
}

export interface ExecutionStep {
  order: number;
  platform: string;
  action: 'BUY' | 'SELL';
  market: string;
  side: string;
  amount: number;
  expectedPrice: number;
  slippageTolerance: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface Trade {
  id: string;
  executionPlanId: string;
  platform: string;
  market: string;
  side: string;
  amount: number;
  price: number;
  fee: number;
  status: 'PENDING' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'FAILED';
  txHash?: string;
  timestamp: string;
}

// ============================================
// System Status Types
// ============================================

export interface SystemStatus {
  isRunning: boolean;
  mode: 'LIVE' | 'DRY_RUN' | 'HALTED';
  uptime: number;
  lastScan: string;
  marketsScanned: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  totalProfit: number;
  agents: AgentStatus[];
  errors: SystemError[];
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  lastActivity: string;
  decisionsToday: number;
  approvalRate: number;
}

export interface SystemError {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  message: string;
  stack?: string;
  timestamp: string;
}

// ============================================
// Configuration Types
// ============================================

export interface SystemConfig {
  ai: AIConfig;
  strategy: StrategyConfig;
  agents: AgentsConfig;
  dataSources: DataSourcesConfig;
  notifications: NotificationsConfig;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'local';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface StrategyConfig {
  riskManagement: {
    maxSemanticRisk: number;
    minIrreversibilityScore: number;
    maxSingleTradeAmount: number;
    maxTotalExposure: number;
    maxDailyLoss: number;
    stopLossPercentage: number;
    requireUnanimousApproval: boolean;
  };
  arbitrageDetection: {
    minProfitMargin: number;
    maxSlippage: number;
    includeFees: boolean;
    validityWindowSeconds: number;
  };
  execution: {
    autoExecute: boolean;
    dryRunMode: boolean;
    confirmBeforeExecute: boolean;
    executionDelayMs: number;
    maxRetries: number;
  };
}

export interface AgentsConfig {
  [key: string]: {
    enabled: boolean;
    useAI: boolean;
    vetoPower: boolean;
  };
}

export interface DataSourcesConfig {
  polymarket: {
    enabled: boolean;
    apiBase: string;
    rateLimitPerMinute: number;
  };
  oddsApi: {
    enabled: boolean;
    apiKey: string;
    apiBase: string;
  };
}

export interface NotificationsConfig {
  enabled: boolean;
  channels: {
    telegram?: { enabled: boolean; botToken: string; chatId: string };
    discord?: { enabled: boolean; webhookUrl: string };
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    processingTimeMs: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
