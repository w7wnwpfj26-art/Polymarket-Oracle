/**
 * Irreversibility Verifier Agent
 * Checks if real-world events are truly irreversible
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

// Indicators of reversibility risk
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
  name = '不可逆驗證器';

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity } = context;
    const market = opportunity.markets.polymarket;

    const warnings: string[] = [];
    let irreversibilityScore = 50; // Start neutral

    const textToAnalyze = `${market.question} ${market.description}`.toLowerCase();

    // Check for reversibility indicators (decrease score)
    for (const indicator of REVERSIBILITY_INDICATORS) {
      if (textToAnalyze.includes(indicator)) {
        irreversibilityScore -= 10;
        warnings.push(`Found reversibility indicator: "${indicator}"`);
      }
    }

    // Check for irreversibility indicators (increase score)
    for (const indicator of IRREVERSIBILITY_INDICATORS) {
      if (textToAnalyze.includes(indicator)) {
        irreversibilityScore += 10;
      }
    }

    // Check end date (past = more likely irreversible)
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

    // Check for future-looking language
    if (/\b(will|would|going to|plan to|intend to)\b/i.test(textToAnalyze)) {
      irreversibilityScore -= 20;
      warnings.push('Contains future-looking language');
    }

    // Check for past tense (good indicator)
    if (/\b(was|were|has been|have been|had)\b/i.test(textToAnalyze)) {
      irreversibilityScore += 10;
    }

    // Clamp score
    irreversibilityScore = Math.max(0, Math.min(100, irreversibilityScore));

    // Determine decision
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
}
