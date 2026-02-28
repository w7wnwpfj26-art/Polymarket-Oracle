/**
 * Multi-Agent Orchestration Service v2
 * - Parallel agent execution
 * - Confidence-weighted voting
 * - Agent priority/weight system
 * - Dynamic threshold adjustment
 */

import type {
  ArbitrageOpportunity,
  ExecutionPlan,
  AgentResponse,
  SystemDecision,
} from '../core/types';
import { AgentManager } from '../agents/manager';
import { getConfig } from '../api/config';
import { tradeExecutionService } from './tradeExecution';
import logger from '../utils/logger';

// Agent weight configuration
const AGENT_WEIGHTS: Record<string, number> = {
  'semantic-judge': 1.2,       // Slightly more weight - semantic risk is critical
  'irreversibility': 1.3,      // Higher weight - event certainty matters most
  'arbitrage': 1.0,            // Standard weight
  'non-trade': 0.8,            // Slightly less - naturally skeptical
  'red-team': 1.1,             // Important adversarial check
  'fail-safe': 1.5,            // Highest weight - last line of defense
};

// Agents that can run in parallel (no dependency on previous responses)
const PARALLEL_GROUP_1 = ['semantic-judge', 'irreversibility', 'arbitrage'];
// Agents that need previous responses
const SEQUENTIAL_GROUP = ['non-trade', 'red-team', 'fail-safe'];

export class OrchestrationService {
  private agentManager: AgentManager;
  private executionHistory: ExecutionPlan[] = [];

  constructor() {
    this.agentManager = new AgentManager();
  }

  /**
   * Analyze an opportunity through all agents (parallel + sequential)
   */
  async analyze(opportunity: ArbitrageOpportunity): Promise<ExecutionPlan> {
    const startTime = Date.now();
    const config = getConfig();
    const agentResponses: AgentResponse[] = [];

    logger.system.info(`[Orchestrator] Analyzing opportunity ${opportunity.id}`);

    // ========== Phase 1: Parallel agents (no dependency on each other) ==========
    const parallelResults = await Promise.allSettled(
      PARALLEL_GROUP_1.map(agentId =>
        this.agentManager.runAgent(agentId, {
          opportunity,
          previousResponses: [],
        })
      )
    );

    let shouldHalt = false;
    for (let i = 0; i < parallelResults.length; i++) {
      const result = parallelResults[i];
      if (result.status === 'fulfilled') {
        agentResponses.push(result.value);
        // Check for veto
        if (result.value.decision === 'REJECT') {
          const agentConfig = config.agents[this.normalizeAgentId(PARALLEL_GROUP_1[i])];
          if (agentConfig?.vetoPower) {
            shouldHalt = true;
            logger.system.info(`[Orchestrator] Agent ${PARALLEL_GROUP_1[i]} vetoed (parallel phase)`);
          }
        }
      } else {
        logger.system.error(`Agent ${PARALLEL_GROUP_1[i]} failed`, { error: result.reason });
        // Create a fallback ABSTAIN response for failed agents
        agentResponses.push({
          agentId: PARALLEL_GROUP_1[i],
          agentName: PARALLEL_GROUP_1[i],
          decision: 'ABSTAIN',
          confidence: 0,
          reasoning: `Agent execution failed: ${result.reason}`,
          warnings: ['Agent error - treating as ABSTAIN'],
          metadata: { error: true },
          timestamp: new Date().toISOString(),
          processingTimeMs: 0,
        });
      }
    }

    // ========== Phase 2: Sequential agents (need context from Phase 1) ==========
    if (!shouldHalt) {
      for (const agentId of SEQUENTIAL_GROUP) {
        if (shouldHalt) break;

        try {
          const response = await this.agentManager.runAgent(agentId, {
            opportunity,
            previousResponses: agentResponses,
          });

          agentResponses.push(response);

          if (response.decision === 'REJECT') {
            const agentConfig = config.agents[this.normalizeAgentId(agentId)];
            if (agentConfig?.vetoPower) {
              shouldHalt = true;
              logger.system.info(`[Orchestrator] Agent ${agentId} vetoed (sequential phase)`);
            }
          }
        } catch (error) {
          logger.system.error(`Agent ${agentId} failed`, { error: (error as Error).message });
          agentResponses.push({
            agentId,
            agentName: agentId,
            decision: 'ABSTAIN',
            confidence: 0,
            reasoning: `Agent execution failed: ${(error as Error).message}`,
            warnings: ['Agent error - treating as ABSTAIN'],
            metadata: { error: true },
            timestamp: new Date().toISOString(),
            processingTimeMs: 0,
          });
        }
      }
    }

    // ========== Final Decision: Confidence-weighted voting ==========
    const finalDecision = this.determineFinalDecision(agentResponses, config);

    const plan: ExecutionPlan = {
      id: crypto.randomUUID(),
      opportunity,
      agentResponses,
      finalDecision,
      unanimousApproval: agentResponses.every(r => r.decision === 'APPROVE'),
      totalCapitalRequired: opportunity.positions.reduce((sum, p) => sum + p.size, 0),
      expectedReturn: opportunity.expectedProfit,
      maxLoss: opportunity.worstCaseLoss,
      executionSteps: opportunity.positions.map((pos, index) => ({
        order: index + 1,
        platform: pos.market.includes('polymarket') ? 'Polymarket' : pos.market,
        action: 'BUY' as const,
        market: opportunity.markets.polymarket.id,
        side: pos.side,
        amount: pos.size,
        expectedPrice: pos.price,
        slippageTolerance: config.strategy.arbitrageDetection.maxSlippage,
        status: 'PENDING' as const,
      })),
      createdAt: new Date().toISOString(),
    };

    const elapsed = Date.now() - startTime;
    logger.system.info(`[Orchestrator] Analysis complete: ${finalDecision} (${elapsed}ms, ${agentResponses.length} agents)`);

    return plan;
  }

  /**
   * Execute an analyzed opportunity
   */
  async execute(opportunity: ArbitrageOpportunity): Promise<{
    success: boolean;
    executionId: string;
    message: string;
  }> {
    const config = getConfig();
    const plan = await this.analyze(opportunity);

    if (plan.finalDecision !== 'EXECUTE') {
      return {
        success: false,
        executionId: plan.id,
        message: `Execution blocked: ${plan.finalDecision}. Reason: ${this.getBlockReason(plan)}`,
      };
    }

    if (config.strategy.execution.dryRunMode) {
      this.executionHistory.push(plan);
      return {
        success: true,
        executionId: plan.id,
        message: '[DRY RUN] Would execute trades. No real orders placed.',
      };
    }

    if (!config.strategy.execution.autoExecute) {
      this.executionHistory.push(plan);
      return {
        success: false,
        executionId: plan.id,
        message: 'Auto-execute is disabled. Plan saved for manual execution.',
      };
    }

    try {
      const result = await tradeExecutionService.executePlan(plan);
      this.executionHistory.push(plan);

      if (result.success) {
        logger.system.info('Trade execution successful', {
          executionId: plan.id,
          tradesCount: result.trades.length,
          totalTimeMs: result.totalTimeMs,
        });
        return {
          success: true,
          executionId: plan.id,
          message: `Successfully executed ${result.trades.length} trades in ${result.totalTimeMs}ms`,
        };
      } else {
        return {
          success: false,
          executionId: plan.id,
          message: `Execution failed: ${result.message}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        executionId: plan.id,
        message: `Execution error: ${(error as Error).message}`,
      };
    }
  }

  getHistory(): ExecutionPlan[] {
    return this.executionHistory.slice(-100);
  }

  getRecentTrades(limit = 50): any[] {
    return tradeExecutionService.getTradeHistory(limit);
  }

  /**
   * Confidence-weighted final decision
   * Each agent's vote is weighted by: agent_weight * (confidence / 100)
   */
  private determineFinalDecision(
    responses: AgentResponse[],
    config: ReturnType<typeof getConfig>
  ): SystemDecision {
    // Step 1: Check for veto power rejections → HALT
    for (const response of responses) {
      if (response.decision === 'REJECT') {
        const agentConfig = config.agents[this.normalizeAgentId(response.agentId)];
        if (agentConfig?.vetoPower) {
          return 'HALT';
        }
      }
    }

    // Step 2: If unanimous approval required
    if (config.strategy.riskManagement.requireUnanimousApproval) {
      const allApproved = responses.every(r => r.decision === 'APPROVE');
      if (!allApproved) return 'HOLD';
    }

    // Step 3: Confidence-weighted voting
    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;

    for (const response of responses) {
      const agentWeight = AGENT_WEIGHTS[response.agentId] || 1.0;
      const effectiveWeight = agentWeight * (response.confidence / 100);
      totalWeight += agentWeight; // Use max potential weight for threshold

      if (response.decision === 'APPROVE') {
        approveWeight += effectiveWeight;
      } else if (response.decision === 'REJECT') {
        rejectWeight += effectiveWeight;
      }
      // ABSTAIN contributes nothing
    }

    // Calculate approval ratio (weighted)
    if (totalWeight === 0) return 'HOLD';
    const approvalRatio = approveWeight / totalWeight;
    const rejectionRatio = rejectWeight / totalWeight;

    logger.system.debug('[Orchestrator] Weighted voting', {
      approveWeight: approveWeight.toFixed(2),
      rejectWeight: rejectWeight.toFixed(2),
      totalWeight: totalWeight.toFixed(2),
      approvalRatio: approvalRatio.toFixed(2),
      rejectionRatio: rejectionRatio.toFixed(2),
    });

    // Dynamic threshold: if any rejection exists, need higher approval ratio
    const threshold = rejectionRatio > 0 ? 0.7 : 0.6;

    if (approvalRatio >= threshold && rejectionRatio < 0.2) {
      return 'EXECUTE';
    }

    return 'HOLD';
  }

  private getBlockReason(plan: ExecutionPlan): string {
    const rejections = plan.agentResponses.filter(r => r.decision === 'REJECT');
    if (rejections.length > 0) {
      return rejections.map(r => `${r.agentName}: ${r.reasoning}`).join('; ');
    }
    return 'Insufficient approval weight';
  }

  private normalizeAgentId(id: string): string {
    const mapping: Record<string, string> = {
      'semantic-judge': 'semanticJudge',
      'irreversibility': 'irreversibilityVerifier',
      'arbitrage': 'arbitrageConstructor',
      'non-trade': 'nonTradeAgent',
      'red-team': 'redTeamSimulator',
      'fail-safe': 'failSafeMonitor',
    };
    return mapping[id] || id;
  }
}
