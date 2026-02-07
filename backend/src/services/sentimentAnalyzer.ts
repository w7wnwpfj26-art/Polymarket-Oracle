/**
 * 社交媒体情绪分析服务
 * 监控 Twitter/Reddit/Discord 市场情绪
 */

import logger from '../utils/logger';
import aiService from './ai';

// ============ 类型定义 ============

export interface SentimentResult {
  score: number;        // -1 到 1，负面到正面
  magnitude: number;    // 情绪强度 0-1
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;   // 置信度 0-100
  sources: SentimentSource[];
  keywords: string[];
  summary: string;
  timestamp: Date;
}

export interface SentimentSource {
  platform: 'twitter' | 'reddit' | 'discord' | 'news';
  count: number;
  avgSentiment: number;
  topPosts: { text: string; engagement: number; sentiment: number }[];
}

export interface MarketSentiment {
  marketId: string;
  marketQuestion: string;
  sentiment: SentimentResult;
  priceImpact: {
    predicted: 'UP' | 'DOWN' | 'STABLE';
    confidence: number;
  };
  alerts: string[];
}

interface SentimentConfig {
  twitterApiKey?: string;
  redditClientId?: string;
  redditClientSecret?: string;
  discordWebhook?: string;
  newsApiKey?: string;
}

// ============ 情绪分析服务 ============

class SentimentAnalyzerService {
  private config: SentimentConfig = {};
  private cache = new Map<string, { result: SentimentResult; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

  /**
   * 配置 API
   */
  configure(config: Partial<SentimentConfig>): void {
    this.config = { ...this.config, ...config };
    logger.system.info('Sentiment analyzer configured');
  }

  /**
   * 分析市场情绪
   */
  async analyzeMarket(marketId: string, question: string): Promise<MarketSentiment> {
    // 检查缓存
    const cached = this.cache.get(marketId);
    if (cached && cached.expiry > Date.now()) {
      return {
        marketId,
        marketQuestion: question,
        sentiment: cached.result,
        priceImpact: this.predictPriceImpact(cached.result),
        alerts: this.generateAlerts(cached.result),
      };
    }

    // 收集各平台数据
    const [twitterData, redditData, newsData] = await Promise.all([
      this.fetchTwitterSentiment(question),
      this.fetchRedditSentiment(question),
      this.fetchNewsSentiment(question),
    ]);

    // 综合分析
    const sentiment = this.aggregateSentiment([twitterData, redditData, newsData]);

    // 缓存结果
    this.cache.set(marketId, { result: sentiment, expiry: Date.now() + this.CACHE_TTL });

    return {
      marketId,
      marketQuestion: question,
      sentiment,
      priceImpact: this.predictPriceImpact(sentiment),
      alerts: this.generateAlerts(sentiment),
    };
  }

  /**
   * 使用 AI 分析文本情绪
   */
  async analyzeTextWithAI(text: string): Promise<{ score: number; label: string; reasoning: string }> {
    try {
      const prompt = `分析以下文本的市场情绪：

"${text}"

请返回 JSON 格式：
{
  "score": <-1到1之间的数字，-1极度看跌，1极度看涨>,
  "label": "<BULLISH/BEARISH/NEUTRAL>",
  "reasoning": "<简短分析>",
  "keywords": ["<关键词1>", "<关键词2>"]
}`;

      const response = await aiService.chat([
        { role: 'system', content: '你是一个金融市场情绪分析专家。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      return JSON.parse(response.content);
    } catch (error) {
      return { score: 0, label: 'NEUTRAL', reasoning: 'AI 分析失败' };
    }
  }

  /**
   * 获取 Twitter 情绪（演示数据）
   */
  private async fetchTwitterSentiment(query: string): Promise<SentimentSource> {
    // 实际实现需要 Twitter API
    // 这里返回模拟数据
    const mockSentiment = Math.random() * 2 - 1; // -1 到 1
    
    return {
      platform: 'twitter',
      count: Math.floor(Math.random() * 500) + 100,
      avgSentiment: mockSentiment,
      topPosts: [
        { 
          text: `关于 "${query.substring(0, 30)}..." 的讨论正在增加`, 
          engagement: Math.floor(Math.random() * 1000),
          sentiment: mockSentiment + (Math.random() - 0.5) * 0.3,
        },
        { 
          text: '市场情绪看起来比较乐观', 
          engagement: Math.floor(Math.random() * 500),
          sentiment: mockSentiment + (Math.random() - 0.5) * 0.3,
        },
      ],
    };
  }

  /**
   * 获取 Reddit 情绪（演示数据）
   */
  private async fetchRedditSentiment(query: string): Promise<SentimentSource> {
    const mockSentiment = Math.random() * 2 - 1;
    
    return {
      platform: 'reddit',
      count: Math.floor(Math.random() * 200) + 50,
      avgSentiment: mockSentiment,
      topPosts: [
        { 
          text: `r/wallstreetbets 讨论: ${query.substring(0, 20)}...`, 
          engagement: Math.floor(Math.random() * 2000),
          sentiment: mockSentiment + (Math.random() - 0.5) * 0.4,
        },
      ],
    };
  }

  /**
   * 获取新闻情绪（演示数据）
   */
  private async fetchNewsSentiment(query: string): Promise<SentimentSource> {
    const mockSentiment = Math.random() * 2 - 1;
    
    return {
      platform: 'news',
      count: Math.floor(Math.random() * 50) + 10,
      avgSentiment: mockSentiment,
      topPosts: [
        { 
          text: `最新财经新闻: ${query.substring(0, 30)}...`, 
          engagement: Math.floor(Math.random() * 10000),
          sentiment: mockSentiment,
        },
      ],
    };
  }

  /**
   * 综合多个来源的情绪
   */
  private aggregateSentiment(sources: SentimentSource[]): SentimentResult {
    const validSources = sources.filter(s => s.count > 0);
    
    if (validSources.length === 0) {
      return {
        score: 0,
        magnitude: 0,
        label: 'NEUTRAL',
        confidence: 0,
        sources: [],
        keywords: [],
        summary: '无足够数据进行分析',
        timestamp: new Date(),
      };
    }

    // 加权平均（按帖子数量）
    const totalCount = validSources.reduce((sum, s) => sum + s.count, 0);
    const weightedScore = validSources.reduce(
      (sum, s) => sum + s.avgSentiment * (s.count / totalCount),
      0
    );

    // 计算强度（情绪一致性）
    const magnitude = Math.min(1, Math.abs(weightedScore) * 1.5);

    // 确定标签
    const label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
      weightedScore > 0.15 ? 'BULLISH' :
      weightedScore < -0.15 ? 'BEARISH' : 'NEUTRAL';

    // 计算置信度
    const confidence = Math.min(100, Math.round(
      (totalCount / 100) * magnitude * 100
    ));

    return {
      score: Math.round(weightedScore * 100) / 100,
      magnitude: Math.round(magnitude * 100) / 100,
      label,
      confidence,
      sources: validSources,
      keywords: this.extractKeywords(validSources),
      summary: this.generateSummary(label, weightedScore, totalCount),
      timestamp: new Date(),
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(sources: SentimentSource[]): string[] {
    const allText = sources
      .flatMap(s => s.topPosts.map(p => p.text))
      .join(' ');
    
    // 简单的关键词提取
    const words = allText.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const wordCount = new Map<string, number>();
    words.forEach(w => wordCount.set(w, (wordCount.get(w) || 0) + 1));
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * 生成摘要
   */
  private generateSummary(label: string, score: number, count: number): string {
    const intensity = Math.abs(score) > 0.5 ? '强烈' : Math.abs(score) > 0.2 ? '中等' : '轻微';
    const direction = label === 'BULLISH' ? '看涨' : label === 'BEARISH' ? '看跌' : '中性';
    
    return `基于 ${count} 条社交媒体帖子分析，市场情绪呈现${intensity}${direction}。情绪得分: ${score.toFixed(2)}`;
  }

  /**
   * 预测价格影响
   */
  private predictPriceImpact(sentiment: SentimentResult): {
    predicted: 'UP' | 'DOWN' | 'STABLE';
    confidence: number;
  } {
    if (sentiment.confidence < 30) {
      return { predicted: 'STABLE', confidence: 30 };
    }

    const predicted: 'UP' | 'DOWN' | 'STABLE' = 
      sentiment.score > 0.2 ? 'UP' :
      sentiment.score < -0.2 ? 'DOWN' : 'STABLE';

    return {
      predicted,
      confidence: Math.min(90, sentiment.confidence * sentiment.magnitude),
    };
  }

  /**
   * 生成警报
   */
  private generateAlerts(sentiment: SentimentResult): string[] {
    const alerts: string[] = [];

    if (Math.abs(sentiment.score) > 0.7) {
      alerts.push(`⚠️ 极端情绪警报: ${sentiment.label}`);
    }

    if (sentiment.magnitude > 0.8) {
      alerts.push('📢 高情绪强度: 市场可能剧烈波动');
    }

    if (sentiment.sources.some(s => s.count > 1000)) {
      alerts.push('🔥 高关注度: 该话题正在病毒式传播');
    }

    return alerts;
  }

  /**
   * 批量分析多个市场
   */
  async analyzeMarkets(markets: { id: string; question: string }[]): Promise<MarketSentiment[]> {
    return Promise.all(
      markets.map(m => this.analyzeMarket(m.id, m.question))
    );
  }

  /**
   * 获取趋势话题
   */
  async getTrendingTopics(): Promise<{ topic: string; volume: number; sentiment: number }[]> {
    // 演示数据
    return [
      { topic: 'Bitcoin ETF', volume: 15000, sentiment: 0.45 },
      { topic: 'Fed Rate Decision', volume: 12000, sentiment: -0.15 },
      { topic: 'AI Stocks', volume: 9500, sentiment: 0.65 },
      { topic: 'Elections 2026', volume: 8000, sentiment: 0.1 },
      { topic: 'Crypto Regulation', volume: 6500, sentiment: -0.35 },
    ];
  }
}

export const sentimentAnalyzer = new SentimentAnalyzerService();
export default sentimentAnalyzer;
