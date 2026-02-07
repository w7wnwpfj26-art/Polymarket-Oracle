/**
 * Non-Trade Decision Agent
 * Specializes in determining when NOT to trade
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

export class NonTradeAgent {
  id = 'non-trade';
  name = '不交易代理';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity, previousResponses } = context;

    const warnings: string[] = [];
    const reasons: string[] = [];
    let skepticismScore = 0;

    // Check previous agent responses
    const rejections = previousResponses.filter(r => r.decision === 'REJECT');
    if (rejections.length > 0) {
      skepticismScore += rejections.length * 25;
      reasons.push(`${rejections.length} previous agent(s) rejected`);
    }

    // Check for abstentions
    const abstentions = previousResponses.filter(r => r.decision === 'ABSTAIN');
    if (abstentions.length > 1) {
      skepticismScore += abstentions.length * 10;
      reasons.push(`${abstentions.length} agents uncertain`);
    }

    // "Too good to be true" check
    if (opportunity.expectedProfitPercent > 10) {
      skepticismScore += 40;
      warnings.push(`Suspiciously high profit (${opportunity.expectedProfitPercent.toFixed(2)}%)`);
      reasons.push('Profit seems too good to be true');
    }

    // Check confidence levels
    const avgConfidence = previousResponses.reduce((sum, r) => sum + r.confidence, 0) / 
                          (previousResponses.length || 1);
    if (avgConfidence < 70) {
      skepticismScore += 20;
      reasons.push('Low average confidence from other agents');
    }

    // Check for warning accumulation
    const totalWarnings = previousResponses.reduce((sum, r) => sum + r.warnings.length, 0);
    if (totalWarnings > 5) {
      skepticismScore += 15;
      warnings.push(`${totalWarnings} warnings from previous agents`);
    }

    // Market-specific red flags
    const market = opportunity.markets.polymarket;
    
    // Low volume = potential manipulation
    if (market.volume24h < 5000) {
      skepticismScore += 20;
      warnings.push('Very low 24h volume - manipulation risk');
    }

    // Price near 0 or 1 = potential trap
    const extremePrices = market.outcomes.filter(o => o.price < 0.05 || o.price > 0.95);
    if (extremePrices.length > 0) {
      skepticismScore += 15;
      warnings.push('Extreme prices detected - potential value trap');
    }

    // Check if opportunity is about to expire
    const validUntil = new Date(opportunity.validUntil);
    if (validUntil.getTime() - Date.now() < 10000) {
      skepticismScore += 30;
      warnings.push('Opportunity expiring in < 10 seconds - rushing is dangerous');
    }

    // Capital preservation mindset
    if (opportunity.worstCaseLoss > 0) {
      skepticismScore += 50;
      reasons.push('Any potential loss should be avoided');
    }

    // Final decision (this agent is naturally skeptical)
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
}
