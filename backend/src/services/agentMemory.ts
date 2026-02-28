/**
 * Agent Memory & Learning Service
 * - RAG: Retrieve relevant past decisions for context
 * - Learning: Track decision outcomes and accuracy
 * - Multi-model: Route to different models based on task
 */

import { getDatabase } from '../db/index';
import { agentMemory } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import aiService from './ai';
import logger from '../utils/logger';

export interface MemoryContext {
  agentId: string;
  marketQuestion: string;
  marketType: string;
}

export interface RelevantMemory {
  decision: string;
  confidence: number;
  wasCorrect: boolean | null;
  profitLoss: number | null;
  marketQuestion: string;
  reasoning: string;
}

class AgentMemoryService {
  /**
   * Store a decision in agent memory
   */
  async recordDecision(params: {
    agentId: string;
    opportunityId: string;
    decision: string;
    confidence: number;
    marketQuestion: string;
    marketType: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) return;

      await db.insert(agentMemory).values({
        agentId: params.agentId,
        opportunityId: params.opportunityId,
        decision: params.decision,
        confidence: params.confidence,
        marketQuestion: params.marketQuestion,
        marketType: params.marketType,
        contextJson: params.context ? JSON.stringify(params.context) : null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.system.warn('Failed to record agent decision', { error: (error as Error).message });
    }
  }

  /**
   * Record the actual outcome of a decision (for learning)
   */
  async recordOutcome(params: {
    opportunityId: string;
    agentId: string;
    wasCorrect: boolean;
    outcome: string;
    profitLoss: number;
  }): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) return;

      await db.update(agentMemory)
        .set({
          wasCorrect: params.wasCorrect,
          outcome: params.outcome,
          profitLoss: params.profitLoss,
          verifiedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(agentMemory.opportunityId, params.opportunityId),
            eq(agentMemory.agentId, params.agentId),
          )
        );
    } catch (error) {
      logger.system.warn('Failed to record outcome', { error: (error as Error).message });
    }
  }

  /**
   * RAG: Retrieve relevant past decisions for context
   * Uses keyword matching + AI similarity scoring
   */
  async getRelevantMemories(context: MemoryContext, limit = 5): Promise<RelevantMemory[]> {
    try {
      const db = getDatabase();
      if (!db) return [];

      // Get recent verified decisions for this agent
      const memories = await db.select()
        .from(agentMemory)
        .where(
          and(
            eq(agentMemory.agentId, context.agentId),
            sql`${agentMemory.wasCorrect} IS NOT NULL` // Only verified outcomes
          )
        )
        .orderBy(desc(agentMemory.createdAt))
        .limit(50); // Fetch more, then filter by relevance

      if (memories.length === 0) return [];

      // Simple keyword-based relevance scoring
      const queryWords = context.marketQuestion.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const scored = memories.map(m => {
        const memWords = (m.marketQuestion || '').toLowerCase().split(/\s+/);
        const overlap = queryWords.filter(w => memWords.some(mw => mw.includes(w) || w.includes(mw)));
        const typeMatch = m.marketType === context.marketType ? 2 : 0;
        return { memory: m, score: overlap.length + typeMatch };
      });

      // Sort by relevance score, take top N
      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, limit).map(s => ({
        decision: s.memory.decision,
        confidence: s.memory.confidence,
        wasCorrect: s.memory.wasCorrect,
        profitLoss: s.memory.profitLoss,
        marketQuestion: s.memory.marketQuestion || '',
        reasoning: s.memory.contextJson ? JSON.parse(s.memory.contextJson).reasoning || '' : '',
      }));
    } catch (error) {
      logger.system.warn('Failed to retrieve memories', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Build RAG context string for AI prompts
   */
  async buildRAGContext(context: MemoryContext): Promise<string> {
    const memories = await this.getRelevantMemories(context);
    
    if (memories.length === 0) {
      return 'No relevant past decisions found.';
    }

    return `Relevant past decisions (${memories.length} found):\n` +
      memories.map((m, i) => {
        const correctStr = m.wasCorrect === null ? 'unverified' : m.wasCorrect ? 'CORRECT' : 'INCORRECT';
        const plStr = m.profitLoss !== null ? ` (P&L: $${m.profitLoss.toFixed(2)})` : '';
        return `${i + 1}. "${m.marketQuestion}" -> ${m.decision} (${m.confidence}%) [${correctStr}${plStr}]`;
      }).join('\n');
  }

  /**
   * Get agent accuracy statistics
   */
  async getAgentStats(agentId: string): Promise<{
    totalDecisions: number;
    verifiedDecisions: number;
    correctDecisions: number;
    accuracy: number;
    avgConfidence: number;
    totalProfitLoss: number;
  }> {
    try {
      const db = getDatabase();
      if (!db) return { totalDecisions: 0, verifiedDecisions: 0, correctDecisions: 0, accuracy: 0, avgConfidence: 0, totalProfitLoss: 0 };

      const all = await db.select().from(agentMemory).where(eq(agentMemory.agentId, agentId));
      const verified = all.filter(m => m.wasCorrect !== null);
      const correct = verified.filter(m => m.wasCorrect);

      return {
        totalDecisions: all.length,
        verifiedDecisions: verified.length,
        correctDecisions: correct.length,
        accuracy: verified.length > 0 ? (correct.length / verified.length) * 100 : 0,
        avgConfidence: all.length > 0 ? all.reduce((s, m) => s + m.confidence, 0) / all.length : 0,
        totalProfitLoss: verified.reduce((s, m) => s + (m.profitLoss || 0), 0),
      };
    } catch {
      return { totalDecisions: 0, verifiedDecisions: 0, correctDecisions: 0, accuracy: 0, avgConfidence: 0, totalProfitLoss: 0 };
    }
  }
}

export const agentMemoryService = new AgentMemoryService();
export default agentMemoryService;
