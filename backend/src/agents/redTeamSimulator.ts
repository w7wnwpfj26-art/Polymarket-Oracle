/**
 * Red Team Simulator Agent
 * Adversarial thinking - tries to find ways the trade could fail
 * Uses AI for deep adversarial analysis when enabled
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';
import { aiService } from '../services/ai';
import { getConfig } from '../api/config';
import logger from '../utils/logger';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

interface AttackVector {
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
}

export class RedTeamSimulator {
  id = 'red-team';
  name = '红队模拟器';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;
    const config = getConfig();

    // Check if AI analysis is enabled
    const useAI = config.agents.redTeamSimulator?.useAI && config.ai.apiKey;

    if (useAI) {
      return this.runWithAI(opportunity, startTime);
    } else {
      return this.runRuleBased(opportunity, startTime);
    }
  }

  /**
   * AI-powered adversarial analysis
   */
  private async runWithAI(opportunity: ArbitrageOpportunity, startTime: number): Promise<AgentResponse> {
    logger.agent.info('RedTeam using AI analysis');

    try {
      const analysis = await aiService.redTeamAnalysis({
        type: opportunity.type,
        markets: opportunity.markets,
        expectedProfit: opportunity.expectedProfit,
      });

      const decision = analysis.recommendation === 'PROCEED' ? 'APPROVE' :
                       analysis.recommendation === 'CAUTION' ? 'ABSTAIN' : 'REJECT';

      const threatScore = analysis.exploitDifficulty === 'LOW' ? 60 :
                          analysis.exploitDifficulty === 'MEDIUM' ? 40 : 20;

      return {
        agentId: this.id,
        agentName: this.name,
        decision,
        confidence: 100 - threatScore,
        reasoning: analysis.analysis || `AI对抗性分析: ${analysis.recommendation}`,
        warnings: analysis.vulnerabilities.map(v => `[AI] ${v}`),
        metadata: {
          totalThreatScore: threatScore,
          vulnerabilities: analysis.vulnerabilities,
          exploitDifficulty: analysis.exploitDifficulty,
          analysisMethod: 'AI',
        },
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.agent.warn('AI analysis failed, falling back to rule-based', {
        error: (error as Error).message
      });
      return this.runRuleBased(opportunity, startTime);
    }
  }

  /**
   * Rule-based adversarial analysis (fallback)
   */
  private async runRuleBased(opportunity: ArbitrageOpportunity, startTime: number): Promise<AgentResponse> {

    const attackVectors: AttackVector[] = [];
    let totalThreatScore = 0;

    // Attack 1: Liquidity Drain
    const market = opportunity.markets.polymarket;
    if (market.liquidity < 50000) {
      attackVectors.push({
        name: 'Liquidity Drain',
        description: 'Adversary could drain liquidity before our order executes',
        severity: market.liquidity < 10000 ? 'CRITICAL' : 'HIGH',
        score: market.liquidity < 10000 ? 30 : 15,
      });
    }

    // Attack 2: Front-running
    if (opportunity.expectedProfitPercent > 2) {
      attackVectors.push({
        name: 'Front-running',
        description: 'MEV bots could detect and front-run this arbitrage',
        severity: 'MEDIUM',
        score: 15,
      });
    }

    // Attack 3: Oracle Manipulation
    if (market.description.toLowerCase().includes('oracle') ||
        market.description.toLowerCase().includes('uma')) {
      attackVectors.push({
        name: 'Oracle Manipulation',
        description: 'Settlement oracle could be influenced or disputed',
        severity: 'HIGH',
        score: 25,
      });
    }

    // Attack 4: Resolution Dispute
    const hasDisputeRisk = /\b(dispute|appeal|contest|challenge)\b/i.test(market.description);
    if (hasDisputeRisk) {
      attackVectors.push({
        name: 'Resolution Dispute',
        description: 'Market resolution could be disputed, delaying or changing outcome',
        severity: 'HIGH',
        score: 25,
      });
    }

    // Attack 5: Price Manipulation
    const priceSum = market.outcomes.reduce((sum, o) => sum + o.price, 0);
    if (Math.abs(priceSum - 1.0) > 0.05) {
      attackVectors.push({
        name: 'Price Manipulation',
        description: 'Prices are abnormal - could be manipulation in progress',
        severity: 'HIGH',
        score: 20,
      });
    }

    // Attack 6: Timing Attack
    const validUntil = new Date(opportunity.validUntil);
    const msRemaining = validUntil.getTime() - Date.now();
    if (msRemaining < 30000) {
      attackVectors.push({
        name: 'Timing Attack',
        description: 'Short window forces rushed decision - classic trap pattern',
        severity: 'MEDIUM',
        score: 15,
      });
    }

    // Attack 7: Cross-platform Settlement Mismatch
    if (opportunity.type === 'CROSS_PLATFORM' && opportunity.markets.traditional) {
      attackVectors.push({
        name: 'Settlement Mismatch',
        description: 'Different platforms may resolve same event differently',
        severity: 'CRITICAL',
        score: 35,
      });
    }

    // Attack 8: Fake Arbitrage Bait
    if (opportunity.expectedProfitPercent > 5 && market.volume24h < 10000) {
      attackVectors.push({
        name: 'Arbitrage Bait',
        description: 'High profit + low volume = possible trap for arbitrageurs',
        severity: 'CRITICAL',
        score: 40,
      });
    }

    // Calculate total threat score
    totalThreatScore = attackVectors.reduce((sum, v) => sum + v.score, 0);

    // Cap at 100
    totalThreatScore = Math.min(100, totalThreatScore);

    // Determine decision
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    const criticalAttacks = attackVectors.filter(a => a.severity === 'CRITICAL');
    
    if (criticalAttacks.length > 0 || totalThreatScore >= 50) {
      decision = 'REJECT';
    } else if (totalThreatScore >= 25) {
      decision = 'ABSTAIN';
    } else {
      decision = 'APPROVE';
    }

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence: 100 - totalThreatScore,
      reasoning: attackVectors.length === 0
        ? 'No significant attack vectors identified'
        : `Identified ${attackVectors.length} potential attack vectors. Most severe: ${
            attackVectors.sort((a, b) => b.score - a.score)[0]?.name || 'None'
          }`,
      warnings: attackVectors.map(v => `[${v.severity}] ${v.name}: ${v.description}`),
      metadata: {
        totalThreatScore,
        attackVectors,
        criticalCount: criticalAttacks.length,
        highCount: attackVectors.filter(a => a.severity === 'HIGH').length,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
