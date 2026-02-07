/**
 * Semantic Judge Agent
 * Analyzes market descriptions for semantic risks
 * Uses AI for deep analysis when enabled
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';
import { aiService } from '../services/ai';
import { getConfig } from '../api/config';
import logger from '../utils/logger';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

// Dangerous keywords that indicate semantic risk
const DANGEROUS_KEYWORDS = [
  'recognized as', 'deemed', 'considered', 'officially',
  'legally', 'judgment', 'discretion', 'interpret',
  'status of', 'will be determined', 'at the discretion',
  'may be', 'could be', 'might be', 'subject to',
  'as decided by', 'in the opinion of', 'according to',
];

const AMBIGUOUS_PATTERNS = [
  /\bif\s+.+\s+then\s+.+\s+otherwise\b/i,
  /\b(may|might|could)\s+(be|have|result)\b/i,
  /\b(recognized|deemed|considered)\s+as\b/i,
  /\b(official|unofficial)\s+sources?\b/i,
  /\bat\s+the\s+discretion\s+of\b/i,
];

export class SemanticJudge {
  id = 'semantic-judge';
  name = '语义法官';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;
    const market = opportunity.markets.polymarket;
    const config = getConfig();

    // Check if AI analysis is enabled
    const useAI = config.agents.semanticJudge?.useAI && config.ai.apiKey;

    if (useAI) {
      return this.runWithAI(market, startTime);
    } else {
      return this.runRuleBased(market, startTime);
    }
  }

  /**
   * AI-powered semantic analysis
   */
  private async runWithAI(market: { question: string; description: string }, startTime: number): Promise<AgentResponse> {
    logger.agent.info('SemanticJudge using AI analysis');

    try {
      const analysis = await aiService.analyzeSemantics({
        question: market.question,
        description: market.description || '',
      });

      const decision = analysis.isMachineSafe ? 'APPROVE' : 
                       analysis.riskScore <= 50 ? 'ABSTAIN' : 'REJECT';

      return {
        agentId: this.id,
        agentName: this.name,
        decision,
        confidence: 100 - analysis.riskScore,
        reasoning: analysis.analysis || `AI分析风险分数: ${analysis.riskScore}/100`,
        warnings: analysis.warnings,
        metadata: {
          riskScore: analysis.riskScore,
          isMachineSafe: analysis.isMachineSafe,
          analysisMethod: 'AI',
        },
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.agent.warn('AI analysis failed, falling back to rule-based', { 
        error: (error as Error).message 
      });
      return this.runRuleBased(market, startTime);
    }
  }

  /**
   * Rule-based semantic analysis (fallback)
   */
  private async runRuleBased(market: { question: string; description: string }, startTime: number): Promise<AgentResponse> {
    const warnings: string[] = [];
    let riskScore = 0;

    const textToAnalyze = `${market.question} ${market.description || ''}`.toLowerCase();

    // Check for dangerous keywords
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        riskScore += 15;
        warnings.push(`发现模糊用语: "${keyword}"`);
      }
    }

    // Check for ambiguous patterns
    for (const pattern of AMBIGUOUS_PATTERNS) {
      if (pattern.test(textToAnalyze)) {
        riskScore += 20;
        warnings.push(`发现模糊模式: ${pattern.source}`);
      }
    }

    // Check for legal/regulatory language
    if (/\b(legal|law|court|regulation|regulatory|compliance)\b/i.test(textToAnalyze)) {
      riskScore += 25;
      warnings.push('包含法律/监管相关语言');
    }

    // Check for subjective terms
    if (/\b(success|fail|good|bad|better|worse|significant|substantial)\b/i.test(textToAnalyze)) {
      riskScore += 10;
      warnings.push('包含主观性用语');
    }

    // Check question clarity
    if (!market.question.endsWith('?')) {
      riskScore += 5;
      warnings.push('问题未以问号结尾');
    }

    // Check description length (too short = unclear)
    if ((market.description || '').length < 50) {
      riskScore += 10;
      warnings.push('描述过短，可能缺乏清晰度');
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    // Determine decision
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (riskScore <= 20) {
      decision = 'APPROVE';
    } else if (riskScore <= 40) {
      decision = 'ABSTAIN';
    } else {
      decision = 'REJECT';
    }

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence: 100 - riskScore,
      reasoning: riskScore <= 30 
        ? '市场描述清晰明确'
        : `语义风险分数: ${riskScore}/100. ${warnings.slice(0, 3).join('. ')}`,
      warnings,
      metadata: {
        riskScore,
        isMachineSafe: riskScore <= 30,
        analysisMethod: 'RULE_BASED',
        analyzedText: textToAnalyze.substring(0, 200),
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
