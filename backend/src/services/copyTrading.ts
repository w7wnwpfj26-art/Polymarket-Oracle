/**
 * 跟单交易系统
 * 利润分成模式
 */

import logger from '../utils/logger';
import { db } from '../db';

// ============ 类型定义 ============

export interface Trader {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  stats: TraderStats;
  settings: TraderSettings;
  followers: number;
  createdAt: Date;
}

export interface TraderStats {
  totalTrades: number;
  winRate: number;           // 胜率 0-100
  profitPercent: number;     // 总收益率
  avgProfitPerTrade: number;
  maxDrawdown: number;       // 最大回撤
  sharpeRatio: number;       // 夏普比率
  lastMonthReturn: number;
  last30dPnL: number;
}

export interface TraderSettings {
  profitShare: number;       // 利润分成比例 0-50
  minCopyAmount: number;     // 最小跟单金额
  maxCopyAmount: number;     // 最大跟单金额
  maxFollowers: number;      // 最大跟随者数
  autoAccept: boolean;       // 自动接受跟随
}

export interface CopyPosition {
  id: string;
  followerId: string;
  traderId: string;
  status: 'active' | 'paused' | 'closed';
  copyAmount: number;
  profitShareRate: number;
  totalCopied: number;
  totalProfit: number;
  paidProfit: number;
  createdAt: Date;
  lastTradeAt?: Date;
}

export interface CopyTrade {
  id: string;
  positionId: string;
  originalTradeId: string;
  traderId: string;
  followerId: string;
  market: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  status: 'pending' | 'executed' | 'failed' | 'settled';
  profit?: number;
  createdAt: Date;
  executedAt?: Date;
  settledAt?: Date;
}

// ============ 跟单系统服务 ============

class CopyTradingService {
  private traders: Map<string, Trader> = new Map();
  private positions: Map<string, CopyPosition> = new Map();
  private trades: CopyTrade[] = [];

  constructor() {
    this.initDemoData();
  }

  /**
   * 初始化演示数据
   */
  private initDemoData(): void {
    // 创建几个演示交易员
    const demoTraders: Trader[] = [
      {
        id: 'trader_1',
        name: 'CryptoWhale',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=whale',
        bio: '专注加密货币预测市场，5年交易经验',
        verified: true,
        stats: {
          totalTrades: 342,
          winRate: 68.5,
          profitPercent: 156.3,
          avgProfitPerTrade: 3.2,
          maxDrawdown: 12.5,
          sharpeRatio: 2.1,
          lastMonthReturn: 12.8,
          last30dPnL: 15420,
        },
        settings: {
          profitShare: 20,
          minCopyAmount: 100,
          maxCopyAmount: 10000,
          maxFollowers: 100,
          autoAccept: true,
        },
        followers: 87,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'trader_2',
        name: 'PoliticalOracle',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=oracle',
        bio: '政治预测专家，专注美国大选和政策市场',
        verified: true,
        stats: {
          totalTrades: 128,
          winRate: 72.3,
          profitPercent: 89.7,
          avgProfitPerTrade: 5.8,
          maxDrawdown: 8.2,
          sharpeRatio: 2.8,
          lastMonthReturn: 8.5,
          last30dPnL: 8900,
        },
        settings: {
          profitShare: 25,
          minCopyAmount: 500,
          maxCopyAmount: 50000,
          maxFollowers: 50,
          autoAccept: false,
        },
        followers: 42,
        createdAt: new Date('2024-03-15'),
      },
      {
        id: 'trader_3',
        name: 'ArbitrageKing',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=king',
        bio: '套利策略大师，低风险稳定收益',
        verified: true,
        stats: {
          totalTrades: 892,
          winRate: 94.2,
          profitPercent: 45.6,
          avgProfitPerTrade: 0.8,
          maxDrawdown: 3.1,
          sharpeRatio: 4.2,
          lastMonthReturn: 4.2,
          last30dPnL: 4350,
        },
        settings: {
          profitShare: 15,
          minCopyAmount: 1000,
          maxCopyAmount: 100000,
          maxFollowers: 200,
          autoAccept: true,
        },
        followers: 156,
        createdAt: new Date('2023-06-01'),
      },
    ];

    demoTraders.forEach(t => this.traders.set(t.id, t));
  }

  // ============ 交易员管理 ============

  /**
   * 获取所有交易员
   */
  getTraders(options?: {
    sortBy?: 'profitPercent' | 'winRate' | 'followers' | 'sharpeRatio';
    verified?: boolean;
    limit?: number;
  }): Trader[] {
    let traders = Array.from(this.traders.values());

    if (options?.verified !== undefined) {
      traders = traders.filter(t => t.verified === options.verified);
    }

    if (options?.sortBy) {
      traders.sort((a, b) => {
        switch (options.sortBy) {
          case 'profitPercent': return b.stats.profitPercent - a.stats.profitPercent;
          case 'winRate': return b.stats.winRate - a.stats.winRate;
          case 'followers': return b.followers - a.followers;
          case 'sharpeRatio': return b.stats.sharpeRatio - a.stats.sharpeRatio;
          default: return 0;
        }
      });
    }

    if (options?.limit) {
      traders = traders.slice(0, options.limit);
    }

    return traders;
  }

  /**
   * 获取单个交易员
   */
  getTrader(id: string): Trader | null {
    return this.traders.get(id) || null;
  }

  /**
   * 注册成为交易员
   */
  registerAsTrader(userId: string, settings: Partial<TraderSettings>): Trader {
    const trader: Trader = {
      id: `trader_${userId}`,
      name: `Trader_${userId.substring(0, 8)}`,
      verified: false,
      stats: {
        totalTrades: 0,
        winRate: 0,
        profitPercent: 0,
        avgProfitPerTrade: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        lastMonthReturn: 0,
        last30dPnL: 0,
      },
      settings: {
        profitShare: settings.profitShare || 20,
        minCopyAmount: settings.minCopyAmount || 100,
        maxCopyAmount: settings.maxCopyAmount || 10000,
        maxFollowers: settings.maxFollowers || 50,
        autoAccept: settings.autoAccept ?? true,
      },
      followers: 0,
      createdAt: new Date(),
    };

    this.traders.set(trader.id, trader);
    logger.system.info('New trader registered', { traderId: trader.id });
    
    return trader;
  }

  // ============ 跟单管理 ============

  /**
   * 开始跟单
   */
  startCopying(followerId: string, traderId: string, amount: number): CopyPosition | null {
    const trader = this.traders.get(traderId);
    if (!trader) {
      logger.system.warn('Trader not found', { traderId });
      return null;
    }

    // 检查限制
    if (amount < trader.settings.minCopyAmount) {
      logger.system.warn('Copy amount too low', { amount, min: trader.settings.minCopyAmount });
      return null;
    }

    if (amount > trader.settings.maxCopyAmount) {
      logger.system.warn('Copy amount too high', { amount, max: trader.settings.maxCopyAmount });
      return null;
    }

    if (trader.followers >= trader.settings.maxFollowers) {
      logger.system.warn('Trader has max followers', { traderId });
      return null;
    }

    // 创建跟单仓位
    const position: CopyPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      followerId,
      traderId,
      status: 'active',
      copyAmount: amount,
      profitShareRate: trader.settings.profitShare,
      totalCopied: 0,
      totalProfit: 0,
      paidProfit: 0,
      createdAt: new Date(),
    };

    this.positions.set(position.id, position);
    trader.followers++;
    
    logger.system.info('Copy position created', { positionId: position.id });
    
    return position;
  }

  /**
   * 停止跟单
   */
  stopCopying(positionId: string): boolean {
    const position = this.positions.get(positionId);
    if (!position) return false;

    position.status = 'closed';
    
    const trader = this.traders.get(position.traderId);
    if (trader) {
      trader.followers = Math.max(0, trader.followers - 1);
    }

    logger.system.info('Copy position closed', { positionId });
    return true;
  }

  /**
   * 暂停跟单
   */
  pauseCopying(positionId: string): boolean {
    const position = this.positions.get(positionId);
    if (!position) return false;

    position.status = position.status === 'paused' ? 'active' : 'paused';
    return true;
  }

  /**
   * 获取用户的跟单仓位
   */
  getPositions(followerId: string): CopyPosition[] {
    return Array.from(this.positions.values())
      .filter(p => p.followerId === followerId);
  }

  /**
   * 获取交易员的跟随者
   */
  getFollowers(traderId: string): CopyPosition[] {
    return Array.from(this.positions.values())
      .filter(p => p.traderId === traderId && p.status !== 'closed');
  }

  // ============ 交易执行 ============

  /**
   * 执行跟单交易
   * 当交易员下单时调用
   */
  async executeCopyTrades(
    traderId: string,
    market: string,
    side: 'YES' | 'NO',
    price: number,
    originalTradeId: string
  ): Promise<CopyTrade[]> {
    const followers = this.getFollowers(traderId);
    const executedTrades: CopyTrade[] = [];

    for (const position of followers) {
      if (position.status !== 'active') continue;

      // 计算跟单金额（按比例）
      const copyAmount = position.copyAmount * 0.1; // 每笔交易使用 10% 资金

      const trade: CopyTrade = {
        id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        positionId: position.id,
        originalTradeId,
        traderId,
        followerId: position.followerId,
        market,
        side,
        amount: copyAmount,
        price,
        status: 'pending',
        createdAt: new Date(),
      };

      try {
        // 这里应该调用实际的交易 API
        // 模拟执行
        trade.status = 'executed';
        trade.executedAt = new Date();
        
        position.totalCopied += copyAmount;
        position.lastTradeAt = new Date();
        
        executedTrades.push(trade);
        this.trades.push(trade);
        
        logger.system.info('Copy trade executed', { tradeId: trade.id });
      } catch (error) {
        trade.status = 'failed';
        this.trades.push(trade);
        logger.system.error('Copy trade failed', { tradeId: trade.id, error: (error as Error).message });
      }
    }

    return executedTrades;
  }

  /**
   * 结算跟单交易
   */
  settleTrade(tradeId: string, profit: number): boolean {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'executed') return false;

    trade.status = 'settled';
    trade.profit = profit;
    trade.settledAt = new Date();

    // 更新仓位统计
    const position = this.positions.get(trade.positionId);
    if (position) {
      position.totalProfit += profit;
      
      // 计算利润分成
      if (profit > 0) {
        const share = profit * (position.profitShareRate / 100);
        position.paidProfit += share;
      }
    }

    return true;
  }

  /**
   * 获取跟单交易历史
   */
  getTradeHistory(options?: {
    followerId?: string;
    traderId?: string;
    positionId?: string;
    limit?: number;
  }): CopyTrade[] {
    let trades = [...this.trades];

    if (options?.followerId) {
      trades = trades.filter(t => t.followerId === options.followerId);
    }
    if (options?.traderId) {
      trades = trades.filter(t => t.traderId === options.traderId);
    }
    if (options?.positionId) {
      trades = trades.filter(t => t.positionId === options.positionId);
    }

    trades.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.limit) {
      trades = trades.slice(0, options.limit);
    }

    return trades;
  }

  // ============ 统计 ============

  /**
   * 获取跟单统计
   */
  getCopyStats(followerId: string): {
    totalPositions: number;
    activePositions: number;
    totalInvested: number;
    totalProfit: number;
    totalPaidFees: number;
    netProfit: number;
  } {
    const positions = this.getPositions(followerId);
    
    return {
      totalPositions: positions.length,
      activePositions: positions.filter(p => p.status === 'active').length,
      totalInvested: positions.reduce((sum, p) => sum + p.copyAmount, 0),
      totalProfit: positions.reduce((sum, p) => sum + p.totalProfit, 0),
      totalPaidFees: positions.reduce((sum, p) => sum + p.paidProfit, 0),
      netProfit: positions.reduce((sum, p) => sum + p.totalProfit - p.paidProfit, 0),
    };
  }

  /**
   * 获取排行榜
   */
  getLeaderboard(period: '7d' | '30d' | 'all' = '30d'): Trader[] {
    return this.getTraders({ sortBy: 'profitPercent', verified: true, limit: 20 });
  }
}

export const copyTradingService = new CopyTradingService();
export default copyTradingService;
