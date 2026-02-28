/**
 * Irreversibility Verifier Agent v2
 * Checks if real-world events are truly irreversible
 * Now uses AI verification alongside rule-based checks
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';
import aiService from '../services/ai';
import { getConfig } from '../api/config';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

const REVERSIBILITY_INDICATORS = [
  'pending', 'tentative', 'preliminary', 'unofficial',
  'unconfirmed', 'alleged', 'reported', 'expected',
  'projected', 'estimated', 'forecast', 'predicted',
];

const IRREVERSIBILITY_INDICATORS = [
  'confirmed', 'official', 'final', 'completed',
  'announced', 'published', 'recorded', 'verified',
  'certified', 'signed', 'enacted', 'ratified',
];

export class IrreversibilityVerifier {
  id = 'irreversibility';
  name = 'Irreversibility Verifier';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;
    const market = opportunity.markets.polymarket;
    const config = getConfig();

    const warnings: string[] = [];
    let irreversibilityScore = 50;

    const textToAnalyze = `${market.question} ${market.description}`.toLowerCase();

    // ========== Rule-based checks ==========

    for (const indicator of REVERSIBILITY_INDICATORS) {
      if (textToAnalyze.includes(indicator)) {
        irreversibilityScore -= 10;
        warnings.push(`Found reversibility indicator: "${indicator}"`);
      }
    }

    for (const indicator of IRREVERSIBILITY_INDICATORS) {
      if (textToAnalyze.includes(indicator)) {
        irreversibilityScore += 10;
      }
    }

    const endDate = new Date(market.endDate);
    const now = new Date();
    if (endDate < now) {
      irreversibilityScore += 20;
    } else {
      const daysUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilEnd < 7) {
        irreversibilityScore += 10;
      } else if (daysUntilEnd > 30) {
        irreversibilityScore -= 15;
        warnings.push('Event is more than 30 days away');
      }
    }

    if (/\b(will|would|going to|plan to|intend to)\b/i.test(textToAnalyze)) {
      irreversibilityScore -= 20;
      warnings.push('Contains future-looking language');
    }

    if (/\b(was|were|has been|have been|had)\b/i.test(textToAnalyze)) {
      irreversibilityScore += 10;
    }

    // ========== AI-enhanced verification ==========
    const agentConfig = config.agents?.irreversibilityVerifier;
    if (agentConfig?.useAI && config.ai?.apiKey) {
      try {
        const aiResult = await this.verifyWithAI(market.question, market.description);
        if (aiResult) {
          // Blend AI score with rule-based score
          irreversibilityScore = Math.round(irreversibilityScore * 0.5 + aiResult.score * 0.5);
          if (aiResult.warnings?.length) {
            warnings.push(...aiResult.warnings.map((w: string) => `[AI] ${w}`));
          }
        }
      } catch (error) {
        warnings.push('[AI] AI verification failed, using rule-based only');
      }
    }

    irreversibilityScore = Math.max(0, Math.min(100, irreversibilityScore));

    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (irreversibilityScore >= 80) {
      decision = 'APPROVE';
    } else if (irreversibilityScore >= 50) {
      decision = 'ABSTAIN';
    } else {
      decision = 'REJECT';
    }

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence: irreversibilityScore,
      reasoning: irreversibilityScore >= 80
        ? 'Event appears to be irreversible and confirmed'
        : `Irreversibility score: ${irreversibilityScore}/100. Event may still be reversible.`,
      warnings,
      metadata: {
        irreversibilityScore,
        eventStatus: irreversibilityScore >= 80 ? 'CONFIRMED' : 
                     irreversibilityScore >= 50 ? 'PENDING' : 'UNKNOWN',
        endDate: market.endDate,
        isPast: endDate < now,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async verifyWithAI(question: string, description: string): Promise<{
    score: number;
    warnings: string[];
    reasoning: string;
  } | null> {
    const prompt = `As an event verification specialist, assess whether this prediction market event is irreversible:

Question: ${question}
Description: ${description}

Evaluate:
1. Has the event already occurred and been confirmed by multiple sources?
2. Could the outcome be reversed, appealed, or changed?
3. Are there any pending legal/regulatory actions that could affect the outcome?
4. How definitive is the language used?

Return JSON: { "score": <0-100, higher=more irreversible>, "warnings": ["..."], "reasoning": "..." }`;

    const response = await aiService.chat([
      { role: 'system', content: 'You are an event verification specialist for prediction markets. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { jsonMode: true });

    return JSON.parse(response.content);
  }
}
