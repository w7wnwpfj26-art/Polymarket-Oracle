/**
 * AI Service - OpenAI/Claude/DeepSeek Integration
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../api/config';
import logger from '../utils/logger';

// AI Provider Types
type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'local';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

// ============ AI Client Factory ============

class AIService {
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  private getOpenAIClient(): OpenAI {
    const config = getConfig();
    if (!this.openaiClient || config.ai.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: config.ai.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config.ai.baseUrl || undefined,
      });
    }
    return this.openaiClient;
  }

  private getAnthropicClient(): Anthropic {
    const config = getConfig();
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: config.ai.apiKey || process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.anthropicClient;
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: AIMessage[], options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const config = getConfig();
    const provider = config.ai.provider as AIProvider;
    const startTime = Date.now();

    logger.ai.info('AI request started', { 
      provider, 
      model: config.ai.model,
      messageCount: messages.length 
    });

    try {
      let response: AIResponse;

      switch (provider) {
        case 'openai':
        case 'deepseek':
          response = await this.chatOpenAI(messages, options);
          break;
        case 'anthropic':
          response = await this.chatAnthropic(messages, options);
          break;
        case 'qwen':
          response = await this.chatQwen(messages, options);
          break;
        case 'local':
          response = await this.chatLocal(messages, options);
          break;
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }

      response.latencyMs = Date.now() - startTime;
      
      logger.ai.info('AI request completed', { 
        provider,
        model: response.model,
        latencyMs: response.latencyMs,
        tokens: response.usage?.totalTokens 
      });

      return response;
    } catch (error) {
      logger.ai.error('AI request failed', { 
        provider, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * OpenAI/DeepSeek Chat Completion
   */
  private async chatOpenAI(messages: AIMessage[], options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const config = getConfig();
    const client = this.getOpenAIClient();

    const response = await client.chat.completions.create({
      model: config.ai.model,
      messages,
      temperature: options?.temperature ?? config.ai.temperature,
      max_tokens: options?.maxTokens ?? config.ai.maxTokens,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    
    return {
      content: choice.message.content || '',
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      latencyMs: 0,
    };
  }

  /**
   * Anthropic Claude Chat Completion
   */
  private async chatAnthropic(messages: AIMessage[], options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const config = getConfig();
    const client = this.getAnthropicClient();

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: config.ai.model,
      max_tokens: options?.maxTokens ?? config.ai.maxTokens ?? 4096,
      system: systemMessage,
      messages: userMessages,
    });

    const content = response.content[0];
    
    return {
      content: content.type === 'text' ? content.text : '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      latencyMs: 0,
    };
  }

  /**
   * Alibaba Qwen (通义千问) Chat Completion
   */
  private async chatQwen(messages: AIMessage[], options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const config = getConfig();
    // 阿里千问 API 兼容 OpenAI 格式
    const baseUrl = config.ai.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const apiKey = config.ai.apiKey || process.env.DASHSCOPE_API_KEY;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model || 'qwen-turbo',
        messages,
        temperature: options?.temperature ?? config.ai.temperature,
        max_tokens: options?.maxTokens ?? config.ai.maxTokens,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || config.ai.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      latencyMs: 0,
    };
  }

  /**
   * Local Ollama Chat Completion
   */
  private async chatLocal(messages: AIMessage[], options?: {
    jsonMode?: boolean;
    temperature?: number;
  }): Promise<AIResponse> {
    const config = getConfig();
    const baseUrl = config.ai.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.model || 'llama2',
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? config.ai.temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      content: data.message?.content || '',
      model: data.model,
      latencyMs: 0,
    };
  }

  /**
   * Analyze market semantics using AI
   */
  async analyzeSemantics(market: {
    question: string;
    description: string;
  }): Promise<{
    riskScore: number;
    isMachineSafe: boolean;
    warnings: string[];
    analysis: string;
  }> {
    const prompt = `你是一个预测市场语义风险分析专家。分析以下市场描述，识别潜在的语义风险。

市场问题：${market.question}

市场描述：${market.description}

请分析以下风险因素：
1. 是否存在模糊或主观的语言（如"被认为"、"官方"、"可能"等）
2. 是否依赖于法律或监管解释
3. 结算标准是否明确且可验证
4. 是否存在后续解释空间

请返回JSON格式的分析结果：
{
  "riskScore": 0-100的风险分数,
  "isMachineSafe": 是否适合自动化交易(true/false),
  "warnings": ["警告1", "警告2"],
  "analysis": "详细分析"
}`;

    try {
      const response = await this.chat([
        { role: 'system', content: '你是一个专业的预测市场风险分析AI。请返回有效的JSON格式。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const result = JSON.parse(response.content);
      return {
        riskScore: result.riskScore || 50,
        isMachineSafe: result.isMachineSafe ?? false,
        warnings: result.warnings || [],
        analysis: result.analysis || '',
      };
    } catch (error) {
      logger.ai.error('Semantic analysis failed', { error: (error as Error).message });
      return {
        riskScore: 50,
        isMachineSafe: false,
        warnings: ['AI分析失败，使用默认值'],
        analysis: '无法完成分析',
      };
    }
  }

  /**
   * Red Team simulation - find ways to exploit the opportunity
   */
  async redTeamAnalysis(opportunity: {
    type: string;
    markets: any;
    expectedProfit: number;
  }): Promise<{
    vulnerabilities: string[];
    exploitDifficulty: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: 'PROCEED' | 'CAUTION' | 'ABORT';
    analysis: string;
  }> {
    const prompt = `你是一个对抗性分析专家。假设你是一个想要破坏这个套利机会的攻击者。

套利类型：${opportunity.type}
预期收益：$${opportunity.expectedProfit}
市场信息：${JSON.stringify(opportunity.markets, null, 2)}

请分析：
1. 作为攻击者，你如何能让这个套利失败？
2. 有哪些潜在的操纵或利用方式？
3. 结算规则是否有漏洞？
4. 是否存在未被考虑的风险？

请返回JSON格式：
{
  "vulnerabilities": ["漏洞1", "漏洞2"],
  "exploitDifficulty": "LOW/MEDIUM/HIGH",
  "recommendation": "PROCEED/CAUTION/ABORT",
  "analysis": "详细分析"
}`;

    try {
      const response = await this.chat([
        { role: 'system', content: '你是一个专业的安全分析专家，擅长发现套利系统的漏洞。请返回有效的JSON格式。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const result = JSON.parse(response.content);
      return {
        vulnerabilities: result.vulnerabilities || [],
        exploitDifficulty: result.exploitDifficulty || 'MEDIUM',
        recommendation: result.recommendation || 'CAUTION',
        analysis: result.analysis || '',
      };
    } catch (error) {
      logger.ai.error('Red team analysis failed', { error: (error as Error).message });
      return {
        vulnerabilities: ['AI分析失败'],
        exploitDifficulty: 'HIGH',
        recommendation: 'ABORT',
        analysis: '无法完成对抗性分析',
      };
    }
  }

  /**
   * Verify event irreversibility
   */
  async verifyIrreversibility(event: {
    description: string;
    claimedOutcome: string;
    sources: string[];
  }): Promise<{
    irreversibilityScore: number;
    isConfirmed: boolean;
    confidence: number;
    reasoning: string;
  }> {
    const prompt = `你是一个事实核查专家。验证以下事件是否已经不可逆转地发生。

事件描述：${event.description}
声称的结果：${event.claimedOutcome}
信息来源：${event.sources.join(', ')}

请分析：
1. 该事件是否已经确定发生？
2. 结果是否可能被推翻或改变？
3. 信息来源是否可靠？
4. 是否存在后续变化的可能？

请返回JSON格式：
{
  "irreversibilityScore": 0-100,
  "isConfirmed": true/false,
  "confidence": 0-100,
  "reasoning": "分析理由"
}`;

    try {
      const response = await this.chat([
        { role: 'system', content: '你是一个事实核查专家。请返回有效的JSON格式。' },
        { role: 'user', content: prompt },
      ], { jsonMode: true });

      const result = JSON.parse(response.content);
      return {
        irreversibilityScore: result.irreversibilityScore || 50,
        isConfirmed: result.isConfirmed ?? false,
        confidence: result.confidence || 50,
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      logger.ai.error('Irreversibility verification failed', { error: (error as Error).message });
      return {
        irreversibilityScore: 0,
        isConfirmed: false,
        confidence: 0,
        reasoning: 'AI验证失败',
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;
