/**
 * 价格趋势预测服务
 * 基于历史数据和情绪分析预测价格走势
 */

import logger from '../utils/logger';
import { sentimentAnalyzer } from './sentimentAnalyzer';
import aiService from './ai';

// ============ 类型定义 ============

export interface PriceHistory {
  timestamp: Date;
  price: number;
  volume: number;
}

export interface PricePrediction {
  marketId: string;
  question: string;
  currentPrice: number;
  predictions: {
    '1h': { price: number; confidence: number; direction: 'UP' | 'DOWN' | 'STABLE' };
    '4h': { price: number; confidence: number; direction: 'UP' | 'DOWN' | 'STABLE' };
    '24h': { price: number; confidence: number; direction: 'UP' | 'DOWN' | 'STABLE' };
    '7d': { price: number; confidence: number; direction: 'UP' | 'DOWN' | 'STABLE' };
  };
  factors: PredictionFactor[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date;
}

export interface PredictionFactor {
  name: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weight: number;
  description: string;
}

// ============ 价格预测服务 ============

class PricePredictorService {
  private priceHistory = new Map<string, PriceHistory[]>();
  
  /**
   * 记录价格
   */
  recordPrice(marketId: string, price: number, volume: number): void {
    const history = this.priceHistory.get(marketId) || [];
    history.push({
      timestamp: new Date(),
      price,
      volume,
    });
    
    // 保留最近 1000 条记录
    if (history.length > 1000) {
      history.shift();
    }
    
    this.priceHistory.set(marketId, history);
  }

  /**
   * 获取价格历史
   */
  getPriceHistory(marketId: string, limit = 100): PriceHistory[] {
    const history = this.priceHistory.get(marketId) || [];
    return history.slice(-limit);
  }

  /**
   * 预测价格走势
   */
  async predictPrice(marketId: string, question: string, currentPrice: number): Promise<PricePrediction> {
    const history = this.getPriceHistory(marketId);
    const factors: PredictionFactor[] = [];

    // 1. 技术分析
    const technicalFactors = this.analyzeTechnical(history, currentPrice);
    factors.push(...technicalFactors);

    // 2. 情绪分析
    try {
      const sentiment = await sentimentAnalyzer.analyzeMarket(marketId, question);
      factors.push({
        name: '市场情绪',
        impact: sentiment.sentiment.label === 'BULLISH' ? 'POSITIVE' : 
                sentiment.sentiment.label === 'BEARISH' ? 'NEGATIVE' : 'NEUTRAL',
        weight: Math.min(0.3, sentiment.sentiment.confidence / 100 * 0.3),
        description: sentiment.sentiment.summary,
      });
    } catch (e) {
      // 情绪分析失败，跳过
    }

    // 3. 计算综合预测
    const predictions = this.calculatePredictions(currentPrice, factors);

    // 4. 风险评估
    const riskLevel = this.assessRisk(history, factors);

    return {
      marketId,
      question,
      currentPrice,
      predictions,
      factors,
      riskLevel,
      timestamp: new Date(),
    };
  }

  /**
   * 使用 AI 进行高级预测
   */
  async predictWithAI(marketId: string, question: string, context: {
    currentPrice: number;
    history: PriceHistory[];
    relatedNews?: string[];
  }): Promise<{ prediction: string; confidence: number; reasoning: string }> {
    try {
      const prompt = `作为金融预测专家，分析以下预测市场：

市场问题: "${question}"
当前价格: ${context.currentPrice} (0-1 之间，表示 YES 的概率)

价格历史 (最近 10 个数据点):
${context.history.slice(-10).map(h => `- ${h.timestamp.toISOString()}: ${h.price.toFixed(3)}`).join('\n')}

${context.relatedNews ? `相关新闻:\n${context.relatedNews.join('\n')}` : ''}

请分析并预测：
1. 未来 24 小时价格走势
2. 预测置信度 (0-100)
3. 关键影响因素

返回 JSON 格式:
{
  "prediction": "UP/DOWN/STABLE",
  "targetPrice": <0-1之间>,
  "confidence": <0-100>,
  "reasoning": "<详细分析>",
  "keyFactors": ["<因素1>", "<因素2>"]
}`;

      const response = await aiService.chat([
        { role: 'system', content: '你是一个专业的预测市场分析师，擅长分析概率变化和市场动态。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      return JSON.parse(response.content);
    } catch (error) {
      logger.system.error('AI prediction failed', { error: (error as Error).message });
      return {
        prediction: 'STABLE',
        confidence: 30,
        reasoning: 'AI 预测失败，无法给出可靠预测',
      };
    }
  }

  /**
   * 技术分析
   */
  private analyzeTechnical(history: PriceHistory[], currentPrice: number): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    if (history.length < 5) {
      return [{
        name: '数据不足',
        impact: 'NEUTRAL',
        weight: 0,
        description: '历史数据不足，无法进行技术分析',
      }];
    }

    // 计算移动平均
    const prices = history.map(h => h.price);
    const ma5 = this.calculateMA(prices, 5);
    const ma20 = this.calculateMA(prices, 20);

    // 趋势分析
    if (ma5 > ma20) {
      factors.push({
        name: '短期趋势',
        impact: 'POSITIVE',
        weight: 0.15,
        description: '5 周期均线高于 20 周期均线，显示上涨趋势',
      });
    } else if (ma5 < ma20) {
      factors.push({
        name: '短期趋势',
        impact: 'NEGATIVE',
        weight: 0.15,
        description: '5 周期均线低于 20 周期均线，显示下跌趋势',
      });
    }

    // 动量分析
    const momentum = this.calculateMomentum(prices, 10);
    factors.push({
      name: '价格动量',
      impact: momentum > 0.02 ? 'POSITIVE' : momentum < -0.02 ? 'NEGATIVE' : 'NEUTRAL',
      weight: Math.min(0.2, Math.abs(momentum) * 2),
      description: `10 周期动量: ${(momentum * 100).toFixed(2)}%`,
    });

    // 波动率分析
    const volatility = this.calculateVolatility(prices, 20);
    factors.push({
      name: '价格波动',
      impact: 'NEUTRAL',
      weight: 0.1,
      description: `20 周期波动率: ${(volatility * 100).toFixed(2)}%`,
    });

    // RSI 分析
    const rsi = this.calculateRSI(prices, 14);
    if (rsi > 70) {
      factors.push({
        name: 'RSI 超买',
        impact: 'NEGATIVE',
        weight: 0.15,
        description: `RSI(14) = ${rsi.toFixed(1)}，市场可能超买`,
      });
    } else if (rsi < 30) {
      factors.push({
        name: 'RSI 超卖',
        impact: 'POSITIVE',
        weight: 0.15,
        description: `RSI(14) = ${rsi.toFixed(1)}，市场可能超卖`,
      });
    }

    return factors;
  }

  /**
   * 计算移动平均
   */
  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  }

  /**
   * 计算动量
   */
  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - period];
    if (past === 0) return 0;
    return (current - past) / past;
  }

  /**
   * 计算波动率
   */
  private calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    const mean = slice.reduce((sum, p) => sum + p, 0) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
    return Math.sqrt(variance);
  }

  /**
   * 计算 RSI
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  /**
   * 计算预测
   */
  private calculatePredictions(currentPrice: number, factors: PredictionFactor[]): PricePrediction['predictions'] {
    // 计算总体影响
    let totalImpact = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      const impact = factor.impact === 'POSITIVE' ? 1 : factor.impact === 'NEGATIVE' ? -1 : 0;
      totalImpact += impact * factor.weight;
      totalWeight += factor.weight;
    }

    const normalizedImpact = totalWeight > 0 ? totalImpact / totalWeight : 0;

    // 生成不同时间段的预测
    const predict = (timeMultiplier: number) => {
      const change = normalizedImpact * 0.05 * timeMultiplier; // 最大变化 5%
      const predictedPrice = Math.max(0, Math.min(1, currentPrice + change));
      const confidence = Math.min(90, Math.abs(normalizedImpact) * 100 + 30);
      const direction: 'UP' | 'DOWN' | 'STABLE' = 
        change > 0.01 ? 'UP' : change < -0.01 ? 'DOWN' : 'STABLE';
      
      return { price: predictedPrice, confidence, direction };
    };

    return {
      '1h': predict(0.25),
      '4h': predict(0.5),
      '24h': predict(1),
      '7d': predict(2),
    };
  }

  /**
   * 风险评估
   */
  private assessRisk(history: PriceHistory[], factors: PredictionFactor[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (history.length < 10) return 'HIGH'; // 数据不足，高风险

    const prices = history.map(h => h.price);
    const volatility = this.calculateVolatility(prices, Math.min(20, prices.length));

    // 基于波动率评估风险
    if (volatility > 0.1) return 'HIGH';
    if (volatility > 0.05) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 获取多个市场的预测摘要
   */
  async getMarketPredictions(markets: { id: string; question: string; price: number }[]): Promise<{
    bullish: number;
    bearish: number;
    neutral: number;
    topOpportunities: { market: string; prediction: 'UP' | 'DOWN'; confidence: number }[];
  }> {
    const predictions = await Promise.all(
      markets.map(m => this.predictPrice(m.id, m.question, m.price))
    );

    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    const opportunities: { market: string; prediction: 'UP' | 'DOWN'; confidence: number }[] = [];

    for (const pred of predictions) {
      const { direction, confidence } = pred.predictions['24h'];
      
      if (direction === 'UP') bullish++;
      else if (direction === 'DOWN') bearish++;
      else neutral++;

      if (direction !== 'STABLE' && confidence > 60) {
        opportunities.push({
          market: pred.question.substring(0, 50),
          prediction: direction,
          confidence,
        });
      }
    }

    return {
      bullish,
      bearish,
      neutral,
      topOpportunities: opportunities.sort((a, b) => b.confidence - a.confidence).slice(0, 5),
    };
  }
}

export const pricePredictor = new PricePredictorService();
export default pricePredictor;
