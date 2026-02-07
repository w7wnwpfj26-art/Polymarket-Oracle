/**
 * Fail-Safe Monitor Agent
 * Last line of defense - monitors for anomalies and triggers emergency stops
 */

import type { AgentResponse, ArbitrageOpportunity } from '../core/types';

interface AgentContext {
  opportunity: ArbitrageOpportunity;
  previousResponses: AgentResponse[];
}

interface AnomalyCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'OK' | 'WARN' | 'FAIL';
}

export class FailSafeMonitor {
  id = 'fail-safe';
  name = '故障安全';

  // Thresholds for anomaly detection
  private readonly THRESHOLDS = {
    maxRejections: 2,
    minConfidence: 50,
    maxWarnings: 10,
    minApprovalRatio: 0.5,
    maxThreatScore: 40,
  };

  async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { opportunity, previousResponses } = context;

    const checks: AnomalyCheck[] = [];
    let failCount = 0;
    let warnCount = 0;

    // Check 1: Rejection count
    const rejections = previousResponses.filter(r => r.decision === 'REJECT').length;
    checks.push({
      name: 'Rejection Threshold',
      passed: rejections <= this.THRESHOLDS.maxRejections,
      message: `${rejections} rejections (max: ${this.THRESHOLDS.maxRejections})`,
      severity: rejections > this.THRESHOLDS.maxRejections ? 'FAIL' : 
                rejections > 1 ? 'WARN' : 'OK',
    });
    if (rejections > this.THRESHOLDS.maxRejections) failCount++;
    else if (rejections > 1) warnCount++;

    // Check 2: Average confidence
    const avgConfidence = previousResponses.length > 0
      ? previousResponses.reduce((sum, r) => sum + r.confidence, 0) / previousResponses.length
      : 0;
    checks.push({
      name: 'Confidence Level',
      passed: avgConfidence >= this.THRESHOLDS.minConfidence,
      message: `Average confidence: ${avgConfidence.toFixed(1)}% (min: ${this.THRESHOLDS.minConfidence}%)`,
      severity: avgConfidence < this.THRESHOLDS.minConfidence ? 'FAIL' :
                avgConfidence < 70 ? 'WARN' : 'OK',
    });
    if (avgConfidence < this.THRESHOLDS.minConfidence) failCount++;
    else if (avgConfidence < 70) warnCount++;

    // Check 3: Warning accumulation
    const totalWarnings = previousResponses.reduce((sum, r) => sum + r.warnings.length, 0);
    checks.push({
      name: 'Warning Count',
      passed: totalWarnings <= this.THRESHOLDS.maxWarnings,
      message: `${totalWarnings} warnings (max: ${this.THRESHOLDS.maxWarnings})`,
      severity: totalWarnings > this.THRESHOLDS.maxWarnings ? 'FAIL' :
                totalWarnings > 5 ? 'WARN' : 'OK',
    });
    if (totalWarnings > this.THRESHOLDS.maxWarnings) failCount++;
    else if (totalWarnings > 5) warnCount++;

    // Check 4: Approval ratio
    const approvals = previousResponses.filter(r => r.decision === 'APPROVE').length;
    const approvalRatio = previousResponses.length > 0 
      ? approvals / previousResponses.length 
      : 0;
    checks.push({
      name: 'Approval Ratio',
      passed: approvalRatio >= this.THRESHOLDS.minApprovalRatio,
      message: `${(approvalRatio * 100).toFixed(1)}% approved (min: ${this.THRESHOLDS.minApprovalRatio * 100}%)`,
      severity: approvalRatio < this.THRESHOLDS.minApprovalRatio ? 'FAIL' :
                approvalRatio < 0.7 ? 'WARN' : 'OK',
    });
    if (approvalRatio < this.THRESHOLDS.minApprovalRatio) failCount++;
    else if (approvalRatio < 0.7) warnCount++;

    // Check 5: Red team threat score
    const redTeamResponse = previousResponses.find(r => r.agentId === 'red-team');
    const threatScore = (redTeamResponse?.metadata as any)?.totalThreatScore || 0;
    checks.push({
      name: 'Threat Assessment',
      passed: threatScore <= this.THRESHOLDS.maxThreatScore,
      message: `Threat score: ${threatScore} (max: ${this.THRESHOLDS.maxThreatScore})`,
      severity: threatScore > this.THRESHOLDS.maxThreatScore ? 'FAIL' :
                threatScore > 25 ? 'WARN' : 'OK',
    });
    if (threatScore > this.THRESHOLDS.maxThreatScore) failCount++;
    else if (threatScore > 25) warnCount++;

    // Check 6: Capital exposure
    const totalCapital = opportunity.positions.reduce((sum, p) => sum + p.size, 0);
    checks.push({
      name: 'Capital Exposure',
      passed: totalCapital <= 5000,
      message: `$${totalCapital.toFixed(2)} exposure`,
      severity: totalCapital > 5000 ? 'FAIL' :
                totalCapital > 2000 ? 'WARN' : 'OK',
    });
    if (totalCapital > 5000) failCount++;
    else if (totalCapital > 2000) warnCount++;

    // Check 7: Worst case loss
    checks.push({
      name: 'Loss Protection',
      passed: opportunity.worstCaseLoss === 0,
      message: opportunity.worstCaseLoss === 0 
        ? 'No worst-case loss' 
        : `Potential loss: $${opportunity.worstCaseLoss.toFixed(2)}`,
      severity: opportunity.worstCaseLoss > 0 ? 'FAIL' : 'OK',
    });
    if (opportunity.worstCaseLoss > 0) failCount++;

    // Final decision - fail-safe is very conservative
    let decision: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    if (failCount > 0) {
      decision = 'REJECT';
    } else if (warnCount >= 3) {
      decision = 'REJECT';
    } else if (warnCount > 0) {
      decision = 'ABSTAIN';
    } else {
      decision = 'APPROVE';
    }

    const passedChecks = checks.filter(c => c.severity === 'OK').length;
    const confidence = (passedChecks / checks.length) * 100;

    return {
      agentId: this.id,
      agentName: this.name,
      decision,
      confidence,
      reasoning: failCount === 0 && warnCount === 0
        ? 'All safety checks passed'
        : `Safety concerns: ${failCount} failures, ${warnCount} warnings`,
      warnings: checks
        .filter(c => c.severity !== 'OK')
        .map(c => `[${c.severity}] ${c.name}: ${c.message}`),
      metadata: {
        checks,
        passedChecks,
        totalChecks: checks.length,
        failCount,
        warnCount,
        shouldHalt: failCount > 0,
      },
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
