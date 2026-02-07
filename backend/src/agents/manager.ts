/**
 * Agent Manager - Coordinates all AI agents
 */

import type { AgentStatus, AgentResponse, ArbitrageOpportunity } from '../core/types';
import { SemanticJudge } from './semanticJudge';
import { IrreversibilityVerifier } from './irreversibilityVerifier';
import { ArbitrageAgent } from './arbitrageAgent';
import { NonTradeAgent } from './nonTradeAgent';
import { RedTeamSimulator } from './redTeamSimulator';
import { FailSafeMonitor } from './failSafeMonitor';

interface Agent {
  id: string;
  name: string;
  run: (context: AgentContext) => Promise<AgentResponse>;
}

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private agentHistory: Map<string, AgentResponse[]> = new Map();

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents() {
    const agentDefinitions: { id: string; name: string; agent: Agent }[] = [
      { id: 'semantic-judge', name: '語義法官', agent: new SemanticJudge() },
      { id: 'irreversibility', name: '不可逆驗證器', agent: new IrreversibilityVerifier() },
      { id: 'arbitrage', name: '套利構造器', agent: new ArbitrageAgent() },
      { id: 'non-trade', name: '不交易代理', agent: new NonTradeAgent() },
      { id: 'red-team', name: '紅隊模擬器', agent: new RedTeamSimulator() },
      { id: 'fail-safe', name: '故障安全', agent: new FailSafeMonitor() },
    ];

    for (const def of agentDefinitions) {
      this.agents.set(def.id, def.agent);
      this.agentStatuses.set(def.id, {
        id: def.id,
        name: def.name,
        status: 'ONLINE',
        lastActivity: new Date().toISOString(),
        decisionsToday: 0,
        approvalRate: 0.85,
      });
      this.agentHistory.set(def.id, []);
    }
  }

  getAllAgents(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  getAgent(id: string): AgentStatus | undefined {
    return this.agentStatuses.get(id);
  }

  toggleAgent(id: string, enabled: boolean): AgentStatus {
    const status = this.agentStatuses.get(id);
    if (!status) {
      throw new Error(`Agent ${id} not found`);
    }

    status.status = enabled ? 'ONLINE' : 'OFFLINE';
    this.agentStatuses.set(id, status);
    return status;
  }

  getAgentHistory(id: string, limit: number = 50): AgentResponse[] {
    const history = this.agentHistory.get(id) || [];
    return history.slice(-limit);
  }

  async runAgent(id: string, context: AgentContext): Promise<AgentResponse> {
    const agent = this.agents.get(id);
    const status = this.agentStatuses.get(id);

    if (!agent || !status) {
      throw new Error(`Agent ${id} not found`);
    }

    if (status.status === 'OFFLINE') {
      return {
        agentId: id,
        agentName: status.name,
        decision: 'ABSTAIN',
        confidence: 0,
        reasoning: 'Agent is offline',
        warnings: ['Agent disabled by configuration'],
        metadata: {},
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const response = await agent.run(context);
      
      // Update status
      status.lastActivity = new Date().toISOString();
      status.decisionsToday++;
      if (response.decision === 'APPROVE') {
        status.approvalRate = (status.approvalRate * (status.decisionsToday - 1) + 1) / status.decisionsToday;
      } else if (response.decision === 'REJECT') {
        status.approvalRate = (status.approvalRate * (status.decisionsToday - 1)) / status.decisionsToday;
      }
      this.agentStatuses.set(id, status);

      // Store in history
      const history = this.agentHistory.get(id) || [];
      history.push(response);
      if (history.length > 1000) history.shift();
      this.agentHistory.set(id, history);

      return response;
    } catch (error) {
      status.status = 'ERROR';
      this.agentStatuses.set(id, status);

      return {
        agentId: id,
        agentName: status.name,
        decision: 'REJECT',
        confidence: 0,
        reasoning: `Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings: ['Agent encountered an error'],
        metadata: { error: true },
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  async testAgent(id: string, testData: any): Promise<AgentResponse> {
    const mockOpportunity: ArbitrageOpportunity = {
      id: 'test-opportunity',
      type: 'DUTCH_BOOK',
      markets: {
        polymarket: {
          id: 'test-market',
          question: testData.question || 'Test market question?',
          description: testData.description || 'Test description',
          outcomes: [
            { name: 'Yes', price: 0.45, odds: 2.22, volume: 10000, side: 'YES' },
            { name: 'No', price: 0.45, odds: 2.22, volume: 10000, side: 'NO' },
          ],
          volume24h: 50000,
          liquidity: 100000,
          endDate: '2026-12-31',
          source: 'polymarket',
          tags: ['test'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      positions: [],
      expectedProfit: 100,
      expectedProfitPercent: 10,
      worstCaseLoss: 0,
      guaranteedProfit: 100,
      confidence: 90,
      validUntil: new Date().toISOString(),
      riskFactors: [],
      createdAt: new Date().toISOString(),
    };

    return this.runAgent(id, {
      opportunity: mockOpportunity,
      previousResponses: [],
    });
  }
}
