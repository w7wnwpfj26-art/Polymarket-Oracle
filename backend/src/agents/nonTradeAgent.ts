/**
 * Non-Trade Decision Agent v2
 * Specializes in determining when NOT to trade
 * Enhanced with AI-powered skepticism
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';
import aiService from '../services/ai';
import { getConfig } from '../api/config';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

export class NonTradeAgent {
  id = 'non-trade';
  name = 'Non-Trade Agent';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity, previousResponses } = context;
    const config = getConfig();

    const warnings: string[] = [];
    const reasons: string[] = [];
    let skepticismScore = 0;

    // ========== Rule-based skepticism ==========

    const rejections = previousResponses.filter(r => r.decision === 'REJECT');
    if (rejections.length > 0) {
      skepticismScore += rejections.length * 25;
      reasons.push(`${rejections.length} previous agent(s) rejected`);
    }

    const abstentions = previousResponses.filter(r => r.decision === 'ABSTAIN');
    if (abstentions.length > 1) {
      skepticismScore += abstentions.length * 10;
      reasons.push(`${abstentions.length} agents uncertain`);
    }

    if (opportunity.expectedProfitPercent > 10) {
      skepticismScore += 40;
      warnings.push(`Suspiciously high profit (${opportunity.expectedProfitPercent.toFixed(2)}%)`);
      reasons.push('Profit seems too good to be true');
    }

    const avgConfidence = previousResponses.reduce((sum, r) => sum + r.confidence, 0) / 
                          (previousResponses.length || 1);
    if (avgConfidence < 70) {
      skepticismScore += 20;
      reasons.push('Low average confidence from other agents');
    }

    const totalWarnings = previousResponses.reduce((sum, r) => sum + r.warnings.length, 0);
    if (totalWarnings > 5) {
      skepticismScore += 15;
      warnings.push(`${totalWarnings} warnings from previous agents`);
    }

    const market = opportunity.markets.polymarket;
    if (market.volume24h < 5000) {
      skepticismScore += 20;
      warnings.push('Very low 24h volume - manipulation risk');
    }

    const extremePrices = market.outcomes.filter(o => o.price < 0.05 || o.price > 0.95);
    if (extremePrices.length > 0) {
      skepticismScore += 15;
      warnings.push('Extreme prices detected - potential value trap');
    }

    const validUntil = new Date(opportunity.validUntil);
    if (validUntil.getTime() - Date.now() < 10000) {
      skepticismScore += 30;
      warnings.push('Opportunity expiring in < 10 seconds - rushing is dangerous');
    }

    if (opportunity.worstCaseLoss > 0) {
      skepticismScore += 50;
      reasons.push('Any potential loss should be avoided');
    }

    // ========== AI-enhanced skepticism ==========
    const agentConfig = config.agents?.nonTradeAgent;
    if (agentConfig?.useAI && config.ai?.apiKey) {
      try {
        const aiResult = await this.skepticAnalysisWithAI(opportunity, previousResponses);
        if (aiResult) {
          // AI can increase or decrease skepticism
          skepticismScore = Math.round(skepticismScore * 0.6 + aiResult.skepticismScore * 0.4);
          if (aiResult.reasons?.length) {
            reasons.push(...aiResult.reasons.map((r: string) => `[AI] ${r}`));
          }
          if (aiResult.warnings?.length) {
            warnings.push(...aiResult.warnings.map((w: string) => `[AI] ${w}`));
          }
        }
      } catch {
        warnings.push('[AI] AI analysis failed, using rule-based only');
      }
    }

    // ========== Decision ==========
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (skepticismScore >= 50) {
      decision = 'REJECT';
    } else if (skepticismScore >= 25) {
      decision = 'ABSTAIN';
    } else {
      decision = 'APPROVE';
    }

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence: 100 - skepticismScore,
      reasoning: decision === 'APPROVE'
        ? 'No significant red flags detected, proceeding is acceptable'
        : `Recommend NOT trading: ${reasons.join('; ')}`,
      warnings,
      metadata: {
        skepticismScore,
        reasons,
        previousRejections: rejections.length,
        previousAbstentions: abstentions.length,
        avgPreviousConfidence: avgConfidence,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async skepticAnalysisWithAI(
    opportunity: ArbitrageOpportunity,
    previousResponses: AgentResponse[]
  ): Promise<{ skepticismScore: number; reasons: string[]; warnings: string[] } | null> {
    const agentSummary = previousResponses.map(r =>
      `${r.agentName}: ${r.decision} (confidence: ${r.confidence}%) - ${r.reasoning}`
    ).join('\n');

    const prompt = `As a skeptical risk analyst, evaluate whether we should AVOID this trade:

Market: ${opportunity.markets.polymarket.question}
Type: ${opportunity.type}
Expected Profit: ${opportunity.expectedProfitPercent.toFixed(2)}%
Volume 24h: $${opportunity.markets.polymarket.volume24h}
Liquidity: $${opportunity.markets.polymarket.liquidity}

Previous agent evaluations:
${agentSummary}

Think like a skeptic: What could go wrong? Why might this be a trap? Is the market efficient enough to make this unlikely?

Return JSON: { "skepticismScore": <0-100>, "reasons": ["..."], "warnings": ["..."] }`;

    const response = await aiService.chat([
      { role: 'system', content: 'You are a skeptical risk analyst. Your job is to find reasons NOT to trade. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { jsonMode: true });

    return JSON.parse(response.content);
  }
}
