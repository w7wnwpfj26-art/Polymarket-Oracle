/**
 * Arbitrage Construction Agent v2
 * Validates and optimizes arbitrage opportunities
 * Now with AI-powered market analysis
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';
import aiService from '../services/ai';
import { getConfig } from '../api/config';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

export class ArbitrageAgent {
  id = 'arbitrage';
  name = 'Arbitrage Constructor';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;
    const config = getConfig();

    const warnings: string[] = [];
    let confidence = 100;

    // ========== Rule-based checks ==========

    if (opportunity.type === 'NONE') {
      return this.buildResponse('REJECT', 100, 'No valid arbitrage opportunity detected',
        ['This is not an arbitrage opportunity'], {}, startTime);
    }

    if (opportunity.worstCaseLoss > 0) {
      confidence -= 30;
      warnings.push(`Worst case loss: $${opportunity.worstCaseLoss.toFixed(2)}`);
    }

    if (opportunity.expectedProfitPercent < 0.5) {
      confidence -= 20;
      warnings.push('Profit margin below 0.5%, may not cover fees');
    }

    if (opportunity.guaranteedProfit <= 0) {
      confidence -= 40;
      warnings.push('No guaranteed profit - this is not true arbitrage');
    }

    if (opportunity.positions.length < 2) {
      confidence -= 25;
      warnings.push('Less than 2 positions - incomplete hedge');
    }

    const totalPrice = opportunity.markets.polymarket.outcomes.reduce((sum, o) => sum + o.price, 0);
    if (totalPrice >= 1.0) {
      confidence -= 20;
      warnings.push(`Sum of probabilities (${totalPrice.toFixed(3)}) >= 1.0`);
    }

    const market = opportunity.markets.polymarket;
    if (market.liquidity < 10000) {
      confidence -= 15;
      warnings.push('Low liquidity - execution risk');
    }

    const validUntil = new Date(opportunity.validUntil);
    const secondsRemaining = (validUntil.getTime() - Date.now()) / 1000;
    if (secondsRemaining < 30) {
      confidence -= 10;
      warnings.push('Less than 30 seconds to execute');
    }

    // ========== AI-enhanced analysis ==========
    const agentConfig = config.agents?.arbitrageConstructor;
    if (agentConfig?.useAI && config.ai?.apiKey) {
      try {
        const aiResult = await this.analyzeWithAI(opportunity);
        if (aiResult) {
          // Blend AI confidence with rule-based confidence
          confidence = Math.round(confidence * 0.6 + aiResult.confidence * 0.4);
          if (aiResult.warnings?.length) {
            warnings.push(...aiResult.warnings.map((w: string) => `[AI] ${w}`));
          }
          if (aiResult.confidence < 50) {
            warnings.push(`[AI] Low AI confidence: ${aiResult.confidence}%`);
          }
        }
      } catch (error) {
        warnings.push('[AI] AI analysis failed, using rule-based only');
      }
    }

    // ========== Decision ==========
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (confidence >= 70 && opportunity.worstCaseLoss === 0) {
      decision = 'APPROVE';
    } else if (confidence >= 50) {
      decision = 'ABSTAIN';
    } else {
      decision = 'REJECT';
    }

    return this.buildResponse(decision, Math.max(0, confidence),
      decision === 'APPROVE'
        ? `Valid ${opportunity.type} opportunity with ${opportunity.expectedProfitPercent.toFixed(2)}% expected profit`
        : `Arbitrage validation failed: ${warnings.join('; ')}`,
      warnings,
      { type: opportunity.type, expectedProfit: opportunity.expectedProfit, totalPrice, positionsCount: opportunity.positions.length },
      startTime);
  }

  private async analyzeWithAI(opportunity: ArbitrageOpportunity): Promise<{
    confidence: number;
    warnings: string[];
    reasoning: string;
  } | null> {
    const prompt = `Analyze this arbitrage opportunity as a quantitative trader:

Market: ${opportunity.markets.polymarket.question}
Type: ${opportunity.type}
Expected Profit: ${opportunity.expectedProfitPercent.toFixed(2)}%
Guaranteed Profit: $${opportunity.guaranteedProfit.toFixed(2)}
Worst Case Loss: $${opportunity.worstCaseLoss.toFixed(2)}
Liquidity: $${opportunity.markets.polymarket.liquidity}
Positions: ${opportunity.positions.map(p => `${p.side} @ ${p.price} x ${p.size}`).join(', ')}

Evaluate: market correlation risk, liquidity adequacy, execution timing risk, fee impact.

Return JSON: { "confidence": <0-100>, "warnings": ["..."], "reasoning": "..." }`;

    const response = await aiService.chat([
      { role: 'system', content: 'You are a quantitative trading analyst. Evaluate arbitrage opportunities. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { jsonMode: true });

    return JSON.parse(response.content);
  }

  private buildResponse(
    decision: 'APPROVE' | 'REJECT' | 'ABSTAIN',
    confidence: number, reasoning: string, warnings: string[],
    metadata: Record<string, unknown>, startTime: number
  ): AgentResponse {
    return {
      agentId: this.id, agentName: this.name, decision, confidence, reasoning, warnings,
      metadata, timestamp: new Date().toISOString(), processingTimeMs: Date.now() - startTime,
    };
  }
}
