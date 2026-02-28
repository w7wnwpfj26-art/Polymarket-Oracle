/**
 * Polymarket Service - Real API Integration
 */

import type { Market, Outcome } from '../core/types';
import { cacheService } from './cache';
import logger from '../utils/logger';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  markets: PolymarketMarket[];
  startDate: string;
  endDate: string;
  volume: number;
  liquidity: number;
  active: boolean;
}

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
}

export class PolymarketService {
  private rateLimitDelay = 100; // ms between requests
  private lastRequest = 0;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private apiPassphrase: string | null = null;

  /**
   * 配置 API 密钥（用于交易）
   * 获取方式：https://docs.polymarket.com/#authentication
   */
  configure(config: { apiKey: string; apiSecret: string; apiPassphrase: string }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.apiPassphrase = config.apiPassphrase;
    logger.system.info('Polymarket API credentials configured');
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.apiPassphrase);
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): HeadersInit {
    if (!this.isConfigured()) {
      return {
        'Accept': 'application/json',
      };
    }
    
    // 简化的认证（实际需要签名）
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey!,
    };
  }

  private async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();
  }

  async getMarkets(params: { page: number; pageSize: number; tag?: string }): Promise<{ data: Market[]; total: number }> {
    await this.throttle();

    // 尝试从缓存获取
    const cacheKey = params.tag ? `markets:${params.tag}` : 'markets:all';
    const cached = await cacheService.getCachedMarkets(params.tag);
    
    if (cached && cached.length > 0) {
      logger.system.info('Polymarket returning cached markets');
      return {
        data: cached.slice(0, params.pageSize),
        total: cached.length
      };
    }

    try {
      // 如果配置了API密钥，使用真实API
      if (this.isConfigured()) {
        logger.system.info('Polymarket fetching real data from API');
        const offset = (params.page - 1) * params.pageSize;
        const url = new URL(`${GAMMA_API}/events`);
        url.searchParams.set('limit', params.pageSize.toString());
        url.searchParams.set('offset', offset.toString());
        url.searchParams.set('active', 'true');
        
        if (params.tag) {
          url.searchParams.set('tag', params.tag);
        }

        const response = await fetch(url.toString(), {
          headers: this.getAuthHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`Polymarket API error: ${response.status}`);
        }

        const events: PolymarketEvent[] = await response.json();
        
        const markets: Market[] = events.flatMap(event => 
          event.markets.map(market => this.transformMarket(market, event))
        );

        // 缓存结果
        if (markets.length > 0) {
          await cacheService.setMarketsCache(markets, params.tag);
        }

        return {
          data: markets,
          total: markets.length * 10, // Estimate
        };
      }
      
      // 否则使用现有的公开API调用
      logger.system.info('Polymarket using public API endpoint');
      const offset = (params.page - 1) * params.pageSize;
      const url = new URL(`${GAMMA_API}/events`);
      url.searchParams.set('limit', params.pageSize.toString());
      url.searchParams.set('offset', offset.toString());
      url.searchParams.set('active', 'true');
      
      if (params.tag) {
        url.searchParams.set('tag', params.tag);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const events: PolymarketEvent[] = await response.json();
      
      const markets: Market[] = events.flatMap(event => 
        event.markets.map(market => this.transformMarket(market, event))
      );

      // 缓存结果
      if (markets.length > 0) {
        await cacheService.setMarketsCache(markets, params.tag);
      }

      return {
        data: markets,
        total: markets.length * 10, // Estimate
      };
    } catch (error) {
      logger.system.error('Polymarket fetch markets failed', { error: (error as Error).message });
      
      // 在生产环境中应该抛出错误而不是返回 mock 数据
      // 这里为了演示暂时保留
      if (process.env.NODE_ENV === 'development') {
        return this.getMockMarkets(params);
      }
      
      throw error;
    }
  }

  async getMarketById(id: string): Promise<Market | null> {
    const cached = await cacheService.getCachedMarket(id);
    if (cached) return cached;

    await this.throttle();

    try {
      const response = await fetch(`${GAMMA_API}/markets/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const market: PolymarketMarket = await response.json();
      const transformed = this.transformMarket(market);
      await cacheService.setMarketCache(transformed);
      return transformed;
    } catch (error) {
      logger.system.error('Polymarket fetch market failed', { marketId: id, error: (error as Error).message });
      
      // 生产环境抛出错误
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
      
      return null;
    }
  }

  private transformMarket(market: PolymarketMarket, event?: PolymarketEvent): Market {
    let outcomes: Outcome[] = [];
    
    try {
      const outcomeNames = JSON.parse(market.outcomes || '["Yes", "No"]');
      const outcomePrices = JSON.parse(market.outcomePrices || '[0.5, 0.5]');
      
      outcomes = outcomeNames.map((name: string, index: number) => ({
        name,
        price: parseFloat(outcomePrices[index]) || 0.5,
        odds: 1 / (parseFloat(outcomePrices[index]) || 0.5),
        volume: parseFloat(market.volume) / outcomeNames.length,
        side: index === 0 ? 'YES' : 'NO',
      }));
    } catch {
      outcomes = [
        { name: 'Yes', price: 0.5, odds: 2, volume: 0, side: 'YES' },
        { name: 'No', price: 0.5, odds: 2, volume: 0, side: 'NO' },
      ];
    }

    return {
      id: market.id,
      question: market.question || event?.title || 'Unknown',
      description: market.description || event?.description || '',
      outcomes,
      volume24h: parseFloat(market.volume) || 0,
      liquidity: parseFloat(market.liquidity) || 0,
      endDate: market.endDate || event?.endDate || '',
      source: 'polymarket',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取订单簿
   */
  async getOrderBook(tokenId: string): Promise<{ bids: any[]; asks: any[] }> {
    await this.throttle();

    try {
      const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
      if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      logger.trade.warn('[Polymarket] Failed to fetch order book', { error });
      return { bids: [], asks: [] };
    }
  }

  /**
   * 获取最佳价格
   */
  async getBestPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number | null> {
    const orderBook = await this.getOrderBook(tokenId);
    
    if (side === 'BUY') {
      return orderBook.asks[0]?.price || null;
    } else {
      return orderBook.bids[0]?.price || null;
    }
  }

  /**
   * 下单（需要 API 密钥）
   * 注意：这是模拟实现，实际需要签名和更复杂的逻辑
   */
  async placeOrder(params: {
    marketId: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
  }): Promise<{ orderId: string; status: string } | null> {
    if (!this.isConfigured()) {
      logger.trade.error('[Polymarket] API credentials not configured. Cannot place order.', { marketId: params.marketId });
      return null;
    }

    await this.throttle();

    try {
      // 注意：实际实现需要：
      // 1. 使用 ethers.js 连接钱包
      // 2. 生成 EIP-712 签名
      // 3. 通过 CLOB API 提交订单

      logger.trade.info('[Polymarket] Order simulation', { params });
      
      // 模拟订单响应
      return {
        orderId: `sim_${Date.now()}`,
        status: 'SIMULATED',
      };
    } catch (error) {
      logger.trade.error('[Polymarket] Failed to place order', { error });
      return null;
    }
  }

  /**
   * 获取用户持仓
   */
  async getPositions(walletAddress: string): Promise<any[]> {
    await this.throttle();

    try {
      const response = await fetch(`${GAMMA_API}/positions?user=${walletAddress}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      logger.trade.error('[Polymarket] Failed to fetch positions', { error });
      return [];
    }
  }

  private getMockMarkets(params: { page: number; pageSize: number }): { data: Market[]; total: number } {
    const mockMarkets: Market[] = [
      {
        id: 'btc-100k-2026',
        question: 'Will Bitcoin reach $100,000 in 2026?',
        description: 'This market resolves YES if BTC/USD reaches $100,000 on any major exchange.',
        outcomes: [
          { name: 'Yes', price: 0.72, odds: 1.39, volume: 1500000, side: 'YES' },
          { name: 'No', price: 0.28, odds: 3.57, volume: 850000, side: 'NO' },
        ],
        volume24h: 125000,
        liquidity: 450000,
        endDate: '2026-12-31T23:59:59Z',
        source: 'polymarket',
        tags: ['crypto', 'bitcoin'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'fed-rate-cut-jan',
        question: 'Will the Fed cut rates in January 2026?',
        description: 'Resolves YES if Federal Reserve announces rate cut at January FOMC meeting.',
        outcomes: [
          { name: 'Yes', price: 0.35, odds: 2.86, volume: 890000, side: 'YES' },
          { name: 'No', price: 0.65, odds: 1.54, volume: 1200000, side: 'NO' },
        ],
        volume24h: 89000,
        liquidity: 320000,
        endDate: '2026-01-31T23:59:59Z',
        source: 'polymarket',
        tags: ['economics', 'federal-reserve'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'super-bowl-2026',
        question: 'Who will win Super Bowl LX?',
        description: 'This market resolves to the winning team of Super Bowl LX.',
        outcomes: [
          { name: 'Chiefs', price: 0.22, odds: 4.55, volume: 2100000, side: 'YES' },
          { name: 'Field', price: 0.78, odds: 1.28, volume: 1800000, side: 'NO' },
        ],
        volume24h: 210000,
        liquidity: 780000,
        endDate: '2026-02-15T23:59:59Z',
        source: 'polymarket',
        tags: ['sports', 'nfl'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return {
      data: mockMarkets.slice(0, params.pageSize),
      total: mockMarkets.length,
    };
  }
}
