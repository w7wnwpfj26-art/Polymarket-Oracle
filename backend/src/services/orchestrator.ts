/**
 * Multi-Agent Orchestration Service
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

export class OrchestrationService {
  private agentManager: AgentManager;
  private executionHistory: ExecutionPlan[] = [];

  constructor() {
    this.agentManager = new AgentManager();
  }

  /**
   * Analyze an opportunity through all agents
   */
  async analyze(opportunity: ArbitrageOpportunity): Promise<ExecutionPlan> {
    const startTime = Date.now();
    const config = getConfig();
    const agentResponses: AgentResponse[] = [];

    console.log(`[Orchestrator] Analyzing opportunity ${opportunity.id}`);

    // Run agents in sequence (order matters for veto)
    const agentOrder = [
      'semantic-judge',
      'irreversibility',
      'arbitrage',
      'non-trade',
      'red-team',
      'fail-safe',
    ];

    let shouldHalt = false;

    for (const agentId of agentOrder) {
      if (shouldHalt) break;

      const response = await this.agentManager.runAgent(agentId, {
        opportunity,
        previousResponses: agentResponses,
      });

      agentResponses.push(response);

      // Check for veto
      if (response.decision === 'REJECT') {
        const agentConfig = config.agents[this.normalizeAgentId(agentId)];
        if (agentConfig?.vetoPower) {
          shouldHalt = true;
          console.log(`[Orchestrator] Agent ${agentId} vetoed the opportunity`);
        }
      }
    }

    // Determine final decision
    const finalDecision = this.determineFinalDecision(agentResponses, config);

    // Build execution plan
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
        action: 'BUY',
        market: opportunity.markets.polymarket.id,
        side: pos.side,
        amount: pos.size,
        expectedPrice: pos.price,
        slippageTolerance: config.strategy.arbitrageDetection.maxSlippage,
        status: 'PENDING',
      })),
      createdAt: new Date().toISOString(),
    };

    console.log(`[Orchestrator] Analysis complete: ${finalDecision} (${Date.now() - startTime}ms)`);

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

    // First, analyze the opportunity
    const plan = await this.analyze(opportunity);

    // Check if we should execute
    if (plan.finalDecision !== 'EXECUTE') {
      return {
        success: false,
        executionId: plan.id,
        message: `Execution blocked: ${plan.finalDecision}. Reason: ${this.getBlockReason(plan)}`,
      };
    }

    // Check dry run mode
    if (config.strategy.execution.dryRunMode) {
      this.executionHistory.push(plan);
      return {
        success: true,
        executionId: plan.id,
        message: '[DRY RUN] Would execute trades. No real orders placed.',
      };
    }

    // Check auto-execute
    if (!config.strategy.execution.autoExecute) {
      this.executionHistory.push(plan);
      return {
        success: false,
        executionId: plan.id,
        message: 'Auto-execute is disabled. Plan saved for manual execution.',
      };
    }

    // TODO: Implement actual trade execution
    // This would integrate with Polymarket's CLOB API and traditional bookmaker APIs
    
    // 实际交易执行逻辑
    try {
      const result = await tradeExecutionService.executePlan(plan);
      
      this.executionHistory.push(plan);
      
      if (result.success) {
        logger.system.info('Trade execution successful', {
          executionId: plan.id,
          tradesCount: result.trades.length,
          totalTimeMs: result.totalTimeMs
        });
        
        return {
          success: true,
          executionId: plan.id,
          message: `Successfully executed ${result.trades.length} trades in ${result.totalTimeMs}ms`,
        };
      } else {
        logger.system.error('Trade execution failed', {
          executionId: plan.id,
          message: result.message
        });
        
        return {
          success: false,
          executionId: plan.id,
          message: `Execution failed: ${result.message}`,
        };
      }
    } catch (error) {
      logger.system.error('Trade execution exception', {
        executionId: plan.id,
        error: (error as Error).message
      });
      
      return {
        success: false,
        executionId: plan.id,
        message: `Execution error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get execution history with trades
   */
  getHistory(): ExecutionPlan[] {
    return this.executionHistory.slice(-100);
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit = 50): any[] {
    return tradeExecutionService.getTradeHistory(limit);
  }

  /**
   * Determine final decision based on agent responses
   */
  private determineFinalDecision(
    responses: AgentResponse[],
    config: ReturnType<typeof getConfig>
  ): SystemDecision {
    // If any agent with veto power rejected, HALT
    for (const response of responses) {
      if (response.decision === 'REJECT') {
        const agentConfig = config.agents[this.normalizeAgentId(response.agentId)];
        if (agentConfig?.vetoPower) {
          return 'HALT';
        }
      }
    }

    // If unanimous approval required
    if (config.strategy.riskManagement.requireUnanimousApproval) {
      const allApproved = responses.every(r => r.decision === 'APPROVE');
      if (!allApproved) {
        return 'HOLD';
      }
    }

    // Count approvals vs rejections
    const approvals = responses.filter(r => r.decision === 'APPROVE').length;
    const rejections = responses.filter(r => r.decision === 'REJECT').length;

    if (rejections > 0) {
      return 'HOLD';
    }

    if (approvals >= responses.length * 0.8) {
      return 'EXECUTE';
    }

    return 'HOLD';
  }

  /**
   * Get reason why execution was blocked
   */
  private getBlockReason(plan: ExecutionPlan): string {
    const rejections = plan.agentResponses.filter(r => r.decision === 'REJECT');
    if (rejections.length > 0) {
      return rejections.map(r => `${r.agentName}: ${r.reasoning}`).join('; ');
    }
    return 'Insufficient approvals';
  }

  /**
   * Normalize agent ID for config lookup
   */
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
