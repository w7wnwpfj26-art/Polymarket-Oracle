/**
 * Arbitrage Construction Agent
 * Validates and optimizes arbitrage opportunities
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

export class ArbitrageAgent {
  id = 'arbitrage';
  name = '套利構造器';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;

    const warnings: string[] = [];
    let confidence = 100;

    // Validate arbitrage type
    if (opportunity.type === 'NONE') {
      return {
        agentId: this.id,
        agentName: this.name,
        decision: 'REJECT',
        confidence: 100,
        reasoning: 'No valid arbitrage opportunity detected',
        warnings: ['This is not an arbitrage opportunity'],
        metadata: {},
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Check worst case loss
    if (opportunity.worstCaseLoss > 0) {
      confidence -= 30;
      warnings.push(`Worst case loss: $${opportunity.worstCaseLoss.toFixed(2)}`);
    }

    // Check profit margin
    if (opportunity.expectedProfitPercent < 0.5) {
      confidence -= 20;
      warnings.push('Profit margin below 0.5%, may not cover fees');
    }

    // Check guaranteed profit
    if (opportunity.guaranteedProfit <= 0) {
      confidence -= 40;
      warnings.push('No guaranteed profit - this is not true arbitrage');
    }

    // Validate positions
    if (opportunity.positions.length < 2) {
      confidence -= 25;
      warnings.push('Less than 2 positions - incomplete hedge');
    }

    // Check for price sum
    const totalPrice = opportunity.markets.polymarket.outcomes.reduce(
      (sum, o) => sum + o.price, 0
    );
    if (totalPrice >= 1.0) {
      confidence -= 20;
      warnings.push(`Sum of probabilities (${totalPrice.toFixed(3)}) >= 1.0`);
    }

    // Check liquidity
    const market = opportunity.markets.polymarket;
    if (market.liquidity < 10000) {
      confidence -= 15;
      warnings.push('Low liquidity - execution risk');
    }

    // Check validity window
    const validUntil = new Date(opportunity.validUntil);
    const secondsRemaining = (validUntil.getTime() - Date.now()) / 1000;
    if (secondsRemaining < 30) {
      confidence -= 10;
      warnings.push('Less than 30 seconds to execute');
    }

    // Determine decision
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (confidence >= 70 && opportunity.worstCaseLoss === 0) {
      decision = 'APPROVE';
    } else if (confidence >= 50) {
      decision = 'ABSTAIN';
    } else {
      decision = 'REJECT';
    }

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence: Math.max(0, confidence),
      reasoning: decision === 'APPROVE'
        ? `Valid ${opportunity.type} opportunity with ${opportunity.expectedProfitPercent.toFixed(2)}% expected profit`
        : `Arbitrage validation failed: ${warnings.join('; ')}`,
      warnings,
      metadata: {
        type: opportunity.type,
        expectedProfit: opportunity.expectedProfit,
        expectedProfitPercent: opportunity.expectedProfitPercent,
        worstCaseLoss: opportunity.worstCaseLoss,
        guaranteedProfit: opportunity.guaranteedProfit,
        totalPrice,
        positionsCount: opportunity.positions.length,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
