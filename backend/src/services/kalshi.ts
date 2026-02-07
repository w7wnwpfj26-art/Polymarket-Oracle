/**
 * Kalshi API Service
 * 美国合规预测市场数据
 * https://kalshi.com
 */

import logger from '../utils/logger';

// ============ 类型定义 ============

export interface KalshiMarket {
  id: string;
  ticker: string;
  title: string;
  subtitle: string;
  category: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  expiration_time: string;
  result?: 'yes' | 'no';
}

export interface KalshiEvent {
  id: string;
  ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

interface KalshiConfig {
  apiUrl: string;
  apiKey?: string;
  email?: string;
  password?: string;
  token?: string;
}

// ============ Kalshi 服务 ============

class KalshiService {
  private config: KalshiConfig = {
    apiUrl: 'https://trading-api.kalshi.com/trade-api/v2',
  };
  
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  /**
   * 配置 API
   */
  configure(config: Partial<KalshiConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.token) {
      this.authToken = config.token;
    }
    logger.system.info('Kalshi API configured');
  }

  /**
   * 登录获取 Token
   */
  async login(): Promise<boolean> {
    if (!this.config.email || !this.config.password) {
      logger.system.warn('Kalshi credentials not configured');
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.config.email,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = await response.json();
      this.authToken = data.token;
      this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时
      
      logger.system.info('Kalshi login successful');
      return true;
    } catch (error) {
      logger.system.error('Kalshi login failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * 获取认证头
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  /**
   * 获取所有事件
   */
  async getEvents(options?: {
    status?: 'open' | 'closed';
    category?: string;
    limit?: number;
  }): Promise<KalshiEvent[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.category) params.append('category', options.category);
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await fetch(
        `${this.config.apiUrl}/events?${params.toString()}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        // 使用演示数据
        return this.getDemoEvents();
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      logger.system.warn('Kalshi API failed, using demo data');
      return this.getDemoEvents();
    }
  }

  /**
   * 获取所有市场
   */
  async getMarkets(options?: {
    status?: 'open' | 'closed';
    eventTicker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.eventTicker) params.append('event_ticker', options.eventTicker);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await fetch(
        `${this.config.apiUrl}/markets?${params.toString()}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return { markets: this.getDemoMarkets() };
      }

      const data = await response.json();
      return {
        markets: data.markets || [],
        cursor: data.cursor,
      };
    } catch (error) {
      logger.system.warn('Kalshi markets API failed, using demo data');
      return { markets: this.getDemoMarkets() };
    }
  }

  /**
   * 获取单个市场
   */
  async getMarket(ticker: string): Promise<KalshiMarket | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/markets/${ticker}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.market;
    } catch (error) {
      logger.system.error('Failed to get Kalshi market', { ticker, error: (error as Error).message });
      return null;
    }
  }

  /**
   * 获取市场历史
   */
  async getMarketHistory(ticker: string, options?: {
    limit?: number;
    minTs?: number;
    maxTs?: number;
  }): Promise<{ price: number; volume: number; ts: number }[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.minTs) params.append('min_ts', options.minTs.toString());
      if (options?.maxTs) params.append('max_ts', options.maxTs.toString());

      const response = await fetch(
        `${this.config.apiUrl}/markets/${ticker}/history?${params.toString()}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取订单簿
   */
  async getOrderbook(ticker: string): Promise<{
    yes: { price: number; quantity: number }[];
    no: { price: number; quantity: number }[];
  } | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/markets/${ticker}/orderbook`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.orderbook;
    } catch (error) {
      return null;
    }
  }

  /**
   * 演示事件数据
   */
  private getDemoEvents(): KalshiEvent[] {
    return [
      {
        id: 'evt_1',
        ticker: 'FED-RATE',
        title: 'Federal Reserve Interest Rate Decision',
        category: 'Economics',
        markets: this.getDemoMarkets().slice(0, 2),
      },
      {
        id: 'evt_2',
        ticker: 'PRES-2024',
        title: '2024 Presidential Election',
        category: 'Politics',
        markets: this.getDemoMarkets().slice(2, 4),
      },
    ];
  }

  /**
   * 演示市场数据
   */
  private getDemoMarkets(): KalshiMarket[] {
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return [
      {
        id: 'mkt_1',
        ticker: 'FED-RATE-JAN-25BPS',
        title: 'Fed raises rates by 25bps in January?',
        subtitle: 'Will the Federal Reserve raise interest rates by 25 basis points?',
        category: 'Economics',
        status: 'open',
        yes_bid: 0.42,
        yes_ask: 0.44,
        no_bid: 0.56,
        no_ask: 0.58,
        last_price: 0.43,
        volume: 125000,
        open_interest: 45000,
        expiration_time: expiry.toISOString(),
      },
      {
        id: 'mkt_2',
        ticker: 'GDP-Q1-2026-2PCT',
        title: 'US GDP growth above 2% in Q1 2026?',
        subtitle: 'Will US GDP growth exceed 2% in the first quarter of 2026?',
        category: 'Economics',
        status: 'open',
        yes_bid: 0.55,
        yes_ask: 0.57,
        no_bid: 0.43,
        no_ask: 0.45,
        last_price: 0.56,
        volume: 89000,
        open_interest: 32000,
        expiration_time: expiry.toISOString(),
      },
      {
        id: 'mkt_3',
        ticker: 'BTC-100K-FEB',
        title: 'Bitcoin above $100K by end of February?',
        subtitle: 'Will Bitcoin price exceed $100,000 before March 1, 2026?',
        category: 'Crypto',
        status: 'open',
        yes_bid: 0.35,
        yes_ask: 0.37,
        no_bid: 0.63,
        no_ask: 0.65,
        last_price: 0.36,
        volume: 234000,
        open_interest: 78000,
        expiration_time: expiry.toISOString(),
      },
      {
        id: 'mkt_4',
        ticker: 'SPX-5000-JAN',
        title: 'S&P 500 closes above 5000 in January?',
        subtitle: 'Will the S&P 500 index close above 5000 points in January 2026?',
        category: 'Stocks',
        status: 'open',
        yes_bid: 0.72,
        yes_ask: 0.74,
        no_bid: 0.26,
        no_ask: 0.28,
        last_price: 0.73,
        volume: 156000,
        open_interest: 52000,
        expiration_time: expiry.toISOString(),
      },
    ];
  }

  /**
   * 转换为通用市场格式
   */
  toUniversalFormat(market: KalshiMarket): {
    id: string;
    question: string;
    source: 'kalshi';
    outcomes: { name: string; price: number; side: string }[];
    volume: number;
    endDate: string;
  } {
    return {
      id: market.id,
      question: market.title,
      source: 'kalshi',
      outcomes: [
        { name: 'Yes', price: (market.yes_bid + market.yes_ask) / 2, side: 'YES' },
        { name: 'No', price: (market.no_bid + market.no_ask) / 2, side: 'NO' },
      ],
      volume: market.volume,
      endDate: market.expiration_time,
    };
  }
}

export const kalshiService = new KalshiService();
export default kalshiService;
