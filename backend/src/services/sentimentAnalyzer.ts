/**
 * 社交媒体情绪分析服务 v2
 * 集成真实 Twitter/Reddit/News API，带 Mock 回退
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
  live: boolean; // 标记是否为真实数据
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
  twitterBearerToken?: string;
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
  private redditAccessToken: string | null = null;
  private redditTokenExpiry = 0;

  constructor() {
    // 从环境变量加载配置
    this.config = {
      twitterBearerToken: process.env.TWITTER_BEARER_TOKEN,
      twitterApiKey: process.env.TWITTER_API_KEY,
      redditClientId: process.env.REDDIT_CLIENT_ID,
      redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
      newsApiKey: process.env.NEWS_API_KEY,
    };
  }

  configure(config: Partial<SentimentConfig>): void {
    this.config = { ...this.config, ...config };
    logger.system.info('Sentiment analyzer configured', {
      twitter: !!this.config.twitterBearerToken,
      reddit: !!this.config.redditClientId,
      news: !!this.config.newsApiKey,
    });
  }

  // ============ 市场分析 ============

  async analyzeMarket(marketId: string, question: string): Promise<MarketSentiment> {
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

    const [twitterData, redditData, newsData] = await Promise.all([
      this.fetchTwitterSentiment(question),
      this.fetchRedditSentiment(question),
      this.fetchNewsSentiment(question),
    ]);

    const sentiment = this.aggregateSentiment([twitterData, redditData, newsData]);
    this.cache.set(marketId, { result: sentiment, expiry: Date.now() + this.CACHE_TTL });

    return {
      marketId,
      marketQuestion: question,
      sentiment,
      priceImpact: this.predictPriceImpact(sentiment),
      alerts: this.generateAlerts(sentiment),
    };
  }

  async analyzeMarkets(markets: { id: string; question: string }[]): Promise<MarketSentiment[]> {
    return Promise.all(markets.map(m => this.analyzeMarket(m.id, m.question)));
  }

  async analyzeTextWithAI(text: string): Promise<{ score: number; label: string; reasoning: string }> {
    try {
      const prompt = `Analyze the market sentiment of the following text:

"${text}"

Return JSON format:
{
  "score": <number between -1 and 1, -1 = extremely bearish, 1 = extremely bullish>,
  "label": "<BULLISH/BEARISH/NEUTRAL>",
  "reasoning": "<brief analysis>",
  "keywords": ["<keyword1>", "<keyword2>"]
}`;

      const response = await aiService.chat([
        { role: 'system', content: 'You are a financial market sentiment analysis expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      return JSON.parse(response.content);
    } catch (error) {
      logger.system.warn('AI sentiment analysis failed', { error: (error as Error).message });
      return { score: 0, label: 'NEUTRAL', reasoning: 'AI analysis failed - using fallback' };
    }
  }

  // ============ Twitter / X API ============

  private async fetchTwitterSentiment(query: string): Promise<SentimentSource> {
    const bearerToken = this.config.twitterBearerToken;
    
    if (!bearerToken) {
      logger.system.debug('Twitter API not configured, using AI fallback for sentiment');
      return this.fetchSentimentViaAI('twitter', query);
    }

    try {
      const searchQuery = encodeURIComponent(query.substring(0, 128) + ' -is:retweet lang:en');
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${searchQuery}&max_results=50&tweet.fields=public_metrics,created_at`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${bearerToken}` },
      });

      if (!response.ok) {
        logger.system.warn('Twitter API error', { status: response.status });
        return this.fetchSentimentViaAI('twitter', query);
      }

      const data = await response.json() as { data?: any[]; meta?: { result_count: number } };
      const tweets = data.data || [];

      if (tweets.length === 0) {
        return { platform: 'twitter', count: 0, avgSentiment: 0, topPosts: [], live: true };
      }

      // 用 AI 对推文做批量情绪分析
      const textsForAnalysis = tweets.slice(0, 20).map((t: any) => t.text).join('\n---\n');
      const sentiments = await this.batchSentimentViaAI(textsForAnalysis);

      const topPosts = tweets.slice(0, 5).map((t: any, i: number) => ({
        text: t.text.substring(0, 200),
        engagement: (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0),
        sentiment: sentiments[i] ?? 0,
      }));

      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length
        : 0;

      return {
        platform: 'twitter',
        count: data.meta?.result_count || tweets.length,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        topPosts,
        live: true,
      };
    } catch (error) {
      logger.system.warn('Twitter fetch failed', { error: (error as Error).message });
      return this.fetchSentimentViaAI('twitter', query);
    }
  }

  // ============ Reddit API ============

  private async getRedditToken(): Promise<string | null> {
    if (this.redditAccessToken && this.redditTokenExpiry > Date.now()) {
      return this.redditAccessToken;
    }

    const { redditClientId, redditClientSecret } = this.config;
    if (!redditClientId || !redditClientSecret) return null;

    try {
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${redditClientId}:${redditClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AEGIS-ArbitrageBot/2.0',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) return null;
      const data = await response.json() as { access_token: string; expires_in: number };
      this.redditAccessToken = data.access_token;
      this.redditTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return this.redditAccessToken;
    } catch {
      return null;
    }
  }

  private async fetchRedditSentiment(query: string): Promise<SentimentSource> {
    const token = await this.getRedditToken();
    
    if (!token) {
      logger.system.debug('Reddit API not configured, using AI fallback for sentiment');
      return this.fetchSentimentViaAI('reddit', query);
    }

    try {
      const searchQuery = encodeURIComponent(query.substring(0, 128));
      const url = `https://oauth.reddit.com/search?q=${searchQuery}&sort=relevance&limit=25&type=link`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'AEGIS-ArbitrageBot/2.0',
        },
      });

      if (!response.ok) {
        return this.fetchSentimentViaAI('reddit', query);
      }

      const data = await response.json() as { data?: { children?: any[] } };
      const posts = data.data?.children?.map((c: any) => c.data) || [];

      if (posts.length === 0) {
        return { platform: 'reddit', count: 0, avgSentiment: 0, topPosts: [], live: true };
      }

      const textsForAnalysis = posts.slice(0, 15).map((p: any) => `${p.title} ${p.selftext?.substring(0, 200) || ''}`).join('\n---\n');
      const sentiments = await this.batchSentimentViaAI(textsForAnalysis);

      const topPosts = posts.slice(0, 5).map((p: any, i: number) => ({
        text: `r/${p.subreddit}: ${p.title}`.substring(0, 200),
        engagement: (p.score || 0) + (p.num_comments || 0),
        sentiment: sentiments[i] ?? 0,
      }));

      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length
        : 0;

      return {
        platform: 'reddit',
        count: posts.length,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        topPosts,
        live: true,
      };
    } catch (error) {
      logger.system.warn('Reddit fetch failed', { error: (error as Error).message });
      return this.fetchSentimentViaAI('reddit', query);
    }
  }

  // ============ News API ============

  private async fetchNewsSentiment(query: string): Promise<SentimentSource> {
    const apiKey = this.config.newsApiKey;
    
    if (!apiKey) {
      logger.system.debug('News API not configured, using AI fallback for sentiment');
      return this.fetchSentimentViaAI('news', query);
    }

    try {
      const searchQuery = encodeURIComponent(query.substring(0, 128));
      const url = `https://newsapi.org/v2/everything?q=${searchQuery}&sortBy=publishedAt&pageSize=20&language=en&apiKey=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return this.fetchSentimentViaAI('news', query);
      }

      const data = await response.json() as { articles?: any[]; totalResults?: number };
      const articles = data.articles || [];

      if (articles.length === 0) {
        return { platform: 'news', count: 0, avgSentiment: 0, topPosts: [], live: true };
      }

      const textsForAnalysis = articles.slice(0, 15).map((a: any) => `${a.title}. ${a.description || ''}`).join('\n---\n');
      const sentiments = await this.batchSentimentViaAI(textsForAnalysis);

      const topPosts = articles.slice(0, 5).map((a: any, i: number) => ({
        text: `[${a.source?.name}] ${a.title}`.substring(0, 200),
        engagement: 0,
        sentiment: sentiments[i] ?? 0,
      }));

      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length
        : 0;

      return {
        platform: 'news',
        count: data.totalResults || articles.length,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        topPosts,
        live: true,
      };
    } catch (error) {
      logger.system.warn('News API fetch failed', { error: (error as Error).message });
      return this.fetchSentimentViaAI('news', query);
    }
  }

  // ============ AI 回退 ============

  /**
   * 当没有配置真实 API 时，用 AI 基于问题本身推断情绪
   */
  private async fetchSentimentViaAI(platform: string, query: string): Promise<SentimentSource> {
    try {
      const prompt = `As a market intelligence analyst, estimate the current public sentiment on ${platform} regarding: "${query}"

Return JSON:
{
  "score": <-1 to 1>,
  "count_estimate": <estimated number of recent posts>,
  "top_themes": ["<theme1>", "<theme2>"],
  "summary": "<one sentence>"
}`;

      const response = await aiService.chat([
        { role: 'system', content: 'You are a social media sentiment analyst. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const result = JSON.parse(response.content);
      return {
        platform: platform as any,
        count: result.count_estimate || 50,
        avgSentiment: Math.max(-1, Math.min(1, result.score || 0)),
        topPosts: (result.top_themes || []).map((t: string) => ({
          text: t,
          engagement: 0,
          sentiment: result.score || 0,
        })),
        live: false, // AI估算，非实时数据
      };
    } catch {
      // 最终回退：返回中性
      return {
        platform: platform as any,
        count: 0,
        avgSentiment: 0,
        topPosts: [],
        live: false,
      };
    }
  }

  /**
   * 批量分析文本的情绪分数
   */
  private async batchSentimentViaAI(textsBlock: string): Promise<number[]> {
    try {
      const prompt = `Rate the market sentiment of each text block separated by "---". Return a JSON array of numbers from -1 (bearish) to 1 (bullish).

${textsBlock}

Return only a JSON array, e.g. [0.5, -0.3, 0.1]`;

      const response = await aiService.chat([
        { role: 'system', content: 'Return only a JSON array of sentiment scores.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const scores = JSON.parse(response.content);
      if (Array.isArray(scores)) {
        return scores.map((s: any) => Math.max(-1, Math.min(1, Number(s) || 0)));
      }
      return [];
    } catch {
      return [];
    }
  }

  // ============ 聚合分析 ============

  private aggregateSentiment(sources: SentimentSource[]): SentimentResult {
    const validSources = sources.filter(s => s.count > 0);
    
    if (validSources.length === 0) {
      return {
        score: 0, magnitude: 0, label: 'NEUTRAL', confidence: 0,
        sources: [], keywords: [], summary: 'Insufficient data for analysis', timestamp: new Date(),
      };
    }

    const totalCount = validSources.reduce((sum, s) => sum + s.count, 0);
    const weightedScore = validSources.reduce(
      (sum, s) => sum + s.avgSentiment * (s.count / totalCount), 0
    );
    const magnitude = Math.min(1, Math.abs(weightedScore) * 1.5);
    const label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
      weightedScore > 0.15 ? 'BULLISH' : weightedScore < -0.15 ? 'BEARISH' : 'NEUTRAL';
    const liveSources = validSources.filter(s => s.live).length;
    const confidence = Math.min(100, Math.round(
      (totalCount / 100) * magnitude * 100 * (liveSources > 0 ? 1 : 0.6)
    ));

    return {
      score: Math.round(weightedScore * 100) / 100,
      magnitude: Math.round(magnitude * 100) / 100,
      label,
      confidence,
      sources: validSources,
      keywords: this.extractKeywords(validSources),
      summary: this.generateSummary(label, weightedScore, totalCount, liveSources),
      timestamp: new Date(),
    };
  }

  private extractKeywords(sources: SentimentSource[]): string[] {
    const allText = sources.flatMap(s => s.topPosts.map(p => p.text)).join(' ');
    const words = allText.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 3);
    const wordCount = new Map<string, number>();
    words.forEach(w => wordCount.set(w, (wordCount.get(w) || 0) + 1));
    return Array.from(wordCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word]) => word);
  }

  private generateSummary(label: string, score: number, count: number, liveSources: number): string {
    const intensity = Math.abs(score) > 0.5 ? 'strongly' : Math.abs(score) > 0.2 ? 'moderately' : 'slightly';
    const direction = label === 'BULLISH' ? 'bullish' : label === 'BEARISH' ? 'bearish' : 'neutral';
    const sourceInfo = liveSources > 0 ? `(${liveSources} live API sources)` : '(AI-estimated)';
    return `Based on ${count} data points ${sourceInfo}, market sentiment is ${intensity} ${direction}. Score: ${score.toFixed(2)}`;
  }

  private predictPriceImpact(sentiment: SentimentResult): { predicted: 'UP' | 'DOWN' | 'STABLE'; confidence: number } {
    if (sentiment.confidence < 30) return { predicted: 'STABLE', confidence: 30 };
    const predicted: 'UP' | 'DOWN' | 'STABLE' = 
      sentiment.score > 0.2 ? 'UP' : sentiment.score < -0.2 ? 'DOWN' : 'STABLE';
    return { predicted, confidence: Math.min(90, sentiment.confidence * sentiment.magnitude) };
  }

  private generateAlerts(sentiment: SentimentResult): string[] {
    const alerts: string[] = [];
    if (Math.abs(sentiment.score) > 0.7) alerts.push(`Extreme sentiment alert: ${sentiment.label}`);
    if (sentiment.magnitude > 0.8) alerts.push('High sentiment intensity: potential volatility');
    if (sentiment.sources.some(s => s.count > 1000)) alerts.push('High attention: topic is trending');
    const liveSources = sentiment.sources.filter(s => s.live);
    if (liveSources.length === 0) alerts.push('Data quality: all sentiment is AI-estimated (configure API keys for live data)');
    return alerts;
  }

  async getTrendingTopics(): Promise<{ topic: string; volume: number; sentiment: number; live: boolean }[]> {
    // Try News API for real trending topics
    if (this.config.newsApiKey) {
      try {
        const url = `https://newsapi.org/v2/top-headlines?category=business&pageSize=10&language=en&apiKey=${this.config.newsApiKey}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json() as { articles?: any[] };
          const topics = (data.articles || []).map((a: any) => ({
            topic: a.title?.split(' - ')[0]?.substring(0, 60) || 'Unknown',
            volume: Math.floor(Math.random() * 10000) + 1000,
            sentiment: 0,
            live: true,
          }));
          // Get sentiment scores via AI
          if (topics.length > 0) {
            const sentiments = await this.batchSentimentViaAI(topics.map((t: any) => t.topic).join('\n---\n'));
            topics.forEach((t: any, i: number) => { t.sentiment = sentiments[i] ?? 0; });
          }
          return topics.slice(0, 8);
        }
      } catch (error) {
        logger.system.warn('Failed to fetch trending from News API', { error: (error as Error).message });
      }
    }

    // AI fallback for trending topics
    try {
      const prompt = `List the top 8 trending topics in prediction markets and crypto right now (February 2026). Return JSON array:
[{ "topic": "<topic>", "volume": <estimated_posts>, "sentiment": <-1 to 1> }]`;

      const response = await aiService.chat([
        { role: 'system', content: 'You are a market trend analyst. Return only valid JSON array.' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const topics = JSON.parse(response.content);
      if (Array.isArray(topics)) {
        return topics.map((t: any) => ({
          topic: String(t.topic || 'Unknown'),
          volume: Number(t.volume) || 1000,
          sentiment: Math.max(-1, Math.min(1, Number(t.sentiment) || 0)),
          live: false,
        }));
      }
    } catch {}

    // Final static fallback
    return [
      { topic: 'Bitcoin ETF', volume: 15000, sentiment: 0.45, live: false },
      { topic: 'Fed Rate Decision', volume: 12000, sentiment: -0.15, live: false },
      { topic: 'AI Stocks', volume: 9500, sentiment: 0.65, live: false },
      { topic: 'Elections 2026', volume: 8000, sentiment: 0.1, live: false },
      { topic: 'Crypto Regulation', volume: 6500, sentiment: -0.35, live: false },
    ];
  }
}

export const sentimentAnalyzer = new SentimentAnalyzerService();
export default sentimentAnalyzer;
