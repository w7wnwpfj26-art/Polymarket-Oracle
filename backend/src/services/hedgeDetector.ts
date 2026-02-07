/**
 * 跨平台对冲机会检测服务
 * 检测 Polymarket 与传统博彩平台之间的对冲机会
 * 
 * 对冲策略：
 * 1. 同一事件在两个平台下相反方向的注
 * 2. 无论结果如何都能获利或最小化损失
 */

import logger from '../utils/logger';
import { oddsParser } from './oddsParser';
import { bettingSiteRepository } from '../db/bettingSiteRepository';
import aiService from './ai';

// ============ 类型定义 ============

export interface MarketData {
  source: 'polymarket' | 'traditional';
  platform: string;
  eventName: string;
  question: string;
  outcomes: OutcomeData[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OutcomeData {
  name: string;
  price: number; // 0-1 for polymarket, decimal odds for traditional
  impliedProbability: number; // 0-100
}

export interface HedgeOpportunity {
  id: string;
  polymarketMarket: MarketData;
  traditionalMarket: MarketData;
  matchConfidence: number; // 0-100 市场匹配置信度
  hedgeType: 'GUARANTEED_PROFIT' | 'REDUCED_RISK' | 'ARBITRAGE';
  
  // 对冲计算结果
  polymarketSide: 'YES' | 'NO';
  traditionalSide: string;
  
  // 投资分配（假设 $1000 总资金）
  polymarketStake: number;
  traditionalStake: number;
  totalInvestment: number;
  
  // 收益预测
  guaranteedProfit: number;
  guaranteedProfitPercent: number;
  worstCaseReturn: number;
  bestCaseReturn: number;
  
  // 赔率信息
  polymarketPrice: number;
  traditionalOdds: number;
  
  // 风险评估
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
  
  createdAt: Date;
  validUntil: Date;
}

export interface MarketMatchResult {
  isMatch: boolean;
  confidence: number;
  matchedOutcomes: { polymarket: string; traditional: string }[];
  reasoning: string;
}

// ============ 对冲检测服务 ============

class HedgeDetectorService {
  private polymarketMarkets: MarketData[] = [];
  private traditionalMarkets: Map<string, MarketData[]> = new Map();
  private opportunities: HedgeOpportunity[] = [];

  /**
   * 更新 Polymarket 市场数据
   */
  updatePolymarketData(markets: MarketData[]): void {
    this.polymarketMarkets = markets.map(m => ({
      ...m,
      source: 'polymarket' as const,
    }));
    logger.system.info('Polymarket markets updated', { count: markets.length });
  }

  /**
   * 更新传统平台市场数据
   */
  updateTraditionalData(platform: string, markets: MarketData[]): void {
    this.traditionalMarkets.set(platform, markets.map(m => ({
      ...m,
      source: 'traditional' as const,
      platform,
    })));
    logger.system.info('Traditional markets updated', { platform, count: markets.length });
  }

  /**
   * 从赔率历史加载传统平台数据
   */
  async loadTraditionalFromHistory(platform: string): Promise<void> {
    const history = await bettingSiteRepository.getOddsHistory({
      siteName: platform,
      limit: 100,
    });

    // 按事件分组
    const eventMap = new Map<string, OutcomeData[]>();
    for (const record of history) {
      if (!eventMap.has(record.eventName)) {
        eventMap.set(record.eventName, []);
      }
      eventMap.get(record.eventName)!.push({
        name: record.selection || 'Unknown',
        price: record.odds,
        impliedProbability: (1 / record.odds) * 100,
      });
    }

    const markets: MarketData[] = Array.from(eventMap.entries()).map(([eventName, outcomes]) => ({
      source: 'traditional' as const,
      platform,
      eventName,
      question: eventName,
      outcomes,
      timestamp: new Date(),
    }));

    this.updateTraditionalData(platform, markets);
  }

  /**
   * 扫描所有对冲机会
   */
  async scanOpportunities(options?: {
    minProfit?: number;
    maxRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    useAI?: boolean;
  }): Promise<HedgeOpportunity[]> {
    const minProfit = options?.minProfit ?? 0;
    const useAI = options?.useAI ?? false;
    
    logger.system.info('Scanning hedge opportunities...', {
      polymarketCount: this.polymarketMarkets.length,
      traditionalPlatforms: this.traditionalMarkets.size,
    });

    const opportunities: HedgeOpportunity[] = [];

    for (const polyMarket of this.polymarketMarkets) {
      for (const [platform, tradMarkets] of this.traditionalMarkets) {
        for (const tradMarket of tradMarkets) {
          // 匹配市场
          const matchResult = useAI
            ? await this.matchMarketsWithAI(polyMarket, tradMarket)
            : this.matchMarkets(polyMarket, tradMarket);

          if (matchResult.isMatch && matchResult.confidence >= 70) {
            // 计算对冲机会
            const hedge = this.calculateHedge(polyMarket, tradMarket, matchResult);
            
            if (hedge && hedge.guaranteedProfit >= minProfit) {
              opportunities.push(hedge);
            }
          }
        }
      }
    }

    // 按利润排序
    opportunities.sort((a, b) => b.guaranteedProfitPercent - a.guaranteedProfitPercent);
    
    this.opportunities = opportunities;
    logger.system.info('Hedge scan complete', { found: opportunities.length });
    
    return opportunities;
  }

  /**
   * 简单市场匹配（关键词匹配）
   */
  matchMarkets(polyMarket: MarketData, tradMarket: MarketData): MarketMatchResult {
    const polyQuestion = polyMarket.question.toLowerCase();
    const tradEvent = tradMarket.eventName.toLowerCase();

    // 提取关键词
    const polyKeywords = this.extractKeywords(polyQuestion);
    const tradKeywords = this.extractKeywords(tradEvent);

    // 计算匹配度
    let matchCount = 0;
    const matchedKeywords: string[] = [];
    
    for (const pk of polyKeywords) {
      for (const tk of tradKeywords) {
        if (pk === tk || this.isSimilar(pk, tk)) {
          matchCount++;
          matchedKeywords.push(pk);
          break;
        }
      }
    }

    const confidence = Math.min(
      100,
      (matchCount / Math.max(polyKeywords.length, tradKeywords.length)) * 100 * 1.5
    );

    // 匹配结果
    const matchedOutcomes: { polymarket: string; traditional: string }[] = [];
    
    if (confidence >= 50) {
      for (const polyOutcome of polyMarket.outcomes) {
        for (const tradOutcome of tradMarket.outcomes) {
          if (this.outcomeMatches(polyOutcome.name, tradOutcome.name)) {
            matchedOutcomes.push({
              polymarket: polyOutcome.name,
              traditional: tradOutcome.name,
            });
          }
        }
      }
    }

    return {
      isMatch: confidence >= 50 && matchedOutcomes.length > 0,
      confidence: Math.round(confidence),
      matchedOutcomes,
      reasoning: `关键词匹配: ${matchedKeywords.join(', ')}`,
    };
  }

  /**
   * AI 市场匹配
   */
  async matchMarketsWithAI(polyMarket: MarketData, tradMarket: MarketData): Promise<MarketMatchResult> {
    try {
      const prompt = `分析以下两个市场是否指向同一事件：

Polymarket 市场：
- 问题: ${polyMarket.question}
- 选项: ${polyMarket.outcomes.map(o => o.name).join(', ')}

传统博彩市场：
- 事件: ${tradMarket.eventName}
- 选项: ${tradMarket.outcomes.map(o => o.name).join(', ')}

请返回 JSON 格式：
{
  "isMatch": true/false,
  "confidence": 0-100,
  "matchedOutcomes": [{"polymarket": "...", "traditional": "..."}],
  "reasoning": "分析理由"
}`;

      const response = await aiService.chat([
        { role: 'system', content: '你是一个市场匹配专家，擅长识别不同平台上的同一事件。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      return JSON.parse(response.content);
    } catch (error) {
      logger.system.error('AI market matching failed', { error: (error as Error).message });
      return this.matchMarkets(polyMarket, tradMarket);
    }
  }

  /**
   * 计算对冲机会
   */
  private calculateHedge(
    polyMarket: MarketData,
    tradMarket: MarketData,
    matchResult: MarketMatchResult
  ): HedgeOpportunity | null {
    if (matchResult.matchedOutcomes.length === 0) return null;

    // 获取第一个匹配的结果
    const matched = matchResult.matchedOutcomes[0];
    
    // 找到对应的价格
    const polyOutcome = polyMarket.outcomes.find(o => 
      o.name.toLowerCase() === matched.polymarket.toLowerCase()
    );
    const tradOutcome = tradMarket.outcomes.find(o => 
      o.name.toLowerCase() === matched.traditional.toLowerCase()
    );

    if (!polyOutcome || !tradOutcome) return null;

    // Polymarket 价格 (0-1)
    const polyYesPrice = polyOutcome.price;
    const polyNoPrice = 1 - polyYesPrice;

    // 传统赔率转换为概率
    const tradOdds = tradOutcome.price;
    const tradImpliedProb = 1 / tradOdds;

    // 对冲计算
    // 策略: 如果 Polymarket YES 价格 + 传统 NO 隐含概率 < 1，存在套利
    // 或者: 如果 Polymarket NO 价格 + 传统 YES 隐含概率 < 1，存在套利

    const totalInvestment = 1000; // 假设 $1000

    // 计算两种对冲方向
    const hedges = [
      this.calculateHedgeDirection(polyYesPrice, tradOdds, totalInvestment, 'YES'),
      this.calculateHedgeDirection(polyNoPrice, 1 / (1 - tradImpliedProb + 0.05), totalInvestment, 'NO'),
    ];

    // 选择最优对冲
    const bestHedge = hedges.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );

    if (bestHedge.profit <= 0) return null;

    const warnings: string[] = [];
    
    // 风险评估
    if (matchResult.confidence < 80) {
      warnings.push(`市场匹配置信度较低 (${matchResult.confidence}%)`);
    }
    if (bestHedge.profitPercent < 1) {
      warnings.push('利润率较低，注意交易成本');
    }
    if (tradOdds < 1.5) {
      warnings.push('传统平台赔率较低');
    }

    const riskLevel = warnings.length === 0 ? 'LOW' : 
                      warnings.length <= 2 ? 'MEDIUM' : 'HIGH';

    return {
      id: `hedge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      polymarketMarket: polyMarket,
      traditionalMarket: tradMarket,
      matchConfidence: matchResult.confidence,
      hedgeType: bestHedge.profit > 0 ? 'GUARANTEED_PROFIT' : 'REDUCED_RISK',
      
      polymarketSide: bestHedge.polySide,
      traditionalSide: matched.traditional,
      
      polymarketStake: bestHedge.polyStake,
      traditionalStake: bestHedge.tradStake,
      totalInvestment,
      
      guaranteedProfit: bestHedge.profit,
      guaranteedProfitPercent: bestHedge.profitPercent,
      worstCaseReturn: bestHedge.worstCase,
      bestCaseReturn: bestHedge.bestCase,
      
      polymarketPrice: bestHedge.polySide === 'YES' ? polyYesPrice : polyNoPrice,
      traditionalOdds: tradOdds,
      
      riskLevel,
      warnings,
      
      createdAt: new Date(),
      validUntil: new Date(Date.now() + 5 * 60 * 1000), // 5分钟有效期
    };
  }

  /**
   * 计算特定方向的对冲
   */
  private calculateHedgeDirection(
    polyPrice: number,
    tradOdds: number,
    totalInvestment: number,
    polySide: 'YES' | 'NO'
  ): {
    polySide: 'YES' | 'NO';
    polyStake: number;
    tradStake: number;
    profit: number;
    profitPercent: number;
    worstCase: number;
    bestCase: number;
  } {
    // Polymarket: 买入 polySide，如果赢得 1/polyPrice
    // 传统: 买入相反方向
    
    // 优化投注比例以保证利润
    // 设 x = Polymarket 投注, y = 传统投注
    // x + y = totalInvestment
    // 场景1 (Polymarket 赢): x / polyPrice = y * tradOdds + profit
    // 场景2 (传统赢): y * tradOdds = x / polyPrice + profit
    
    // 简化: 按隐含概率分配
    const polyImpliedProb = polyPrice;
    const tradImpliedProb = 1 / tradOdds;
    
    // 检查是否存在套利 (两边隐含概率之和 < 1)
    const totalImpliedProb = polyImpliedProb + tradImpliedProb;
    
    if (totalImpliedProb >= 1) {
      // 没有套利机会
      return {
        polySide,
        polyStake: 0,
        tradStake: 0,
        profit: 0,
        profitPercent: 0,
        worstCase: 0,
        bestCase: 0,
      };
    }

    // 按比例分配
    const polyRatio = tradImpliedProb / (polyImpliedProb + tradImpliedProb);
    const tradRatio = 1 - polyRatio;

    const polyStake = totalInvestment * polyRatio;
    const tradStake = totalInvestment * tradRatio;

    // 计算回报
    const polyWinReturn = polyStake / polyPrice;
    const tradWinReturn = tradStake * tradOdds;

    // 利润 = 最小回报 - 总投资
    const minReturn = Math.min(polyWinReturn, tradWinReturn);
    const profit = minReturn - totalInvestment;
    const profitPercent = (profit / totalInvestment) * 100;

    return {
      polySide,
      polyStake: Math.round(polyStake * 100) / 100,
      tradStake: Math.round(tradStake * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitPercent: Math.round(profitPercent * 100) / 100,
      worstCase: Math.round(minReturn * 100) / 100,
      bestCase: Math.round(Math.max(polyWinReturn, tradWinReturn) * 100) / 100,
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除常见词
    const stopWords = new Set([
      'will', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
      'but', 'if', 'or', 'because', 'until', 'while', 'although',
      '的', '是', '在', '了', '和', '与', '或', '将', '会', '能',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * 检查两个词是否相似
   */
  private isSimilar(word1: string, word2: string): boolean {
    if (word1 === word2) return true;
    
    // Levenshtein 距离
    const distance = this.levenshteinDistance(word1, word2);
    const maxLen = Math.max(word1.length, word2.length);
    
    return distance / maxLen < 0.3;
  }

  /**
   * 检查结果是否匹配
   */
  private outcomeMatches(outcome1: string, outcome2: string): boolean {
    const o1 = outcome1.toLowerCase();
    const o2 = outcome2.toLowerCase();
    
    if (o1 === o2) return true;
    
    // 常见等价词
    const equivalents: [string[], string[]][] = [
      [['yes', 'true', '是', '会', 'win'], ['yes', 'true', '是', '会', 'win']],
      [['no', 'false', '否', '不会', 'lose'], ['no', 'false', '否', '不会', 'lose']],
      [['over', 'above', '大'], ['over', 'above', '大']],
      [['under', 'below', '小'], ['under', 'below', '小']],
    ];

    for (const [group1, group2] of equivalents) {
      if (group1.some(w => o1.includes(w)) && group2.some(w => o2.includes(w))) {
        return true;
      }
    }

    return this.isSimilar(o1, o2);
  }

  /**
   * Levenshtein 距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 获取当前机会
   */
  getOpportunities(): HedgeOpportunity[] {
    // 过滤过期的机会
    const now = new Date();
    return this.opportunities.filter(o => o.validUntil > now);
  }

  /**
   * 获取特定机会
   */
  getOpportunity(id: string): HedgeOpportunity | undefined {
    return this.opportunities.find(o => o.id === id);
  }

  /**
   * 获取市场状态
   */
  getStatus(): {
    polymarketCount: number;
    traditionalPlatforms: { name: string; count: number }[];
    opportunityCount: number;
  } {
    return {
      polymarketCount: this.polymarketMarkets.length,
      traditionalPlatforms: Array.from(this.traditionalMarkets.entries()).map(([name, markets]) => ({
        name,
        count: markets.length,
      })),
      opportunityCount: this.getOpportunities().length,
    };
  }
}

// Export singleton
export const hedgeDetector = new HedgeDetectorService();
export default hedgeDetector;
