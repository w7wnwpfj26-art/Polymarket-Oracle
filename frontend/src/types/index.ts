// Frontend Types

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
}

export interface Outcome {
  name: string;
  price: number;
  odds?: number;
  volume: number;
  side: string;
}

export interface ArbitrageOpportunity {
  id: string;
  type: 'DUTCH_BOOK' | 'HEDGE_ARB' | 'CROSS_PLATFORM' | 'NONE';
  markets: {
    polymarket: Market;
    traditional?: any;
  };
  expectedProfit: number;
  expectedProfitPercent: number;
  worstCaseLoss: number;
  confidence: number;
  validUntil: string;
}

export interface Agent {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  lastActivity: string;
  decisionsToday: number;
  approvalRate: number;
}

export interface SystemStatus {
  isRunning: boolean;
  mode: 'LIVE' | 'DRY_RUN' | 'HALTED';
  uptime: number;
  lastScan: string;
  marketsScanned: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  totalProfit: number;
  agents: Agent[];
}
