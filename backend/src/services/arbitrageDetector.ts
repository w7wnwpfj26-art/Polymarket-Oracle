/**
 * Arbitrage Detector Service
 */

import type { ArbitrageOpportunity, Market, TraditionalOdds, ArbitrageType } from '../core/types';
import { PolymarketService } from './polymarket';
import { OddsApiService } from './oddsApi';

export class ArbitrageDetector {
  private polymarket: PolymarketService;
  private oddsApi: OddsApiService;

  constructor() {
    this.polymarket = new PolymarketService();
    this.oddsApi = new OddsApiService();
  }

  async scan(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // Fetch markets from both sources
      const [polymarketData, oddsData] = await Promise.all([
        this.polymarket.getMarkets({ page: 1, pageSize: 50 }),
        this.oddsApi.getAllOdds(),
      ]);

      // Check for Dutch Book opportunities (within Polymarket)
      for (const market of polymarketData.data) {
        const dutchBook = this.detectDutchBook(market);
        if (dutchBook) {
          opportunities.push(dutchBook);
        }
      }

      // Check for cross-platform arbitrage
      for (const market of polymarketData.data) {
        for (const odds of oddsData) {
          const crossPlatform = this.detectCrossPlatformArb(market, odds);
          if (crossPlatform) {
            opportunities.push(crossPlatform);
          }
        }
      }

    } catch (error) {
      console.error('[ArbitrageDetector] Scan failed:', error);
    }

    // Sort by profit potential
    return opportunities.sort((a, b) => b.expectedProfitPercent - a.expectedProfitPercent);
  }

  /**
   * Dutch Book Detection
   * If sum of implied probabilities < 1, there's a guaranteed profit
   */
  private detectDutchBook(market: Market): ArbitrageOpportunity | null {
    const totalImpliedProb = market.outcomes.reduce((sum, o) => sum + o.price, 0);
    
    // Perfect Dutch Book: total < 1.0
    // With fees (~2%), need total < 0.98
    if (totalImpliedProb >= 0.98) {
      return null;
    }

    const profitPercent = (1 - totalImpliedProb) * 100;
    const capitalRequired = 1000; // Base calculation unit
    const guaranteedProfit = capitalRequired * (1 - totalImpliedProb);

    return {
      id: `dutch-${market.id}-${Date.now()}`,
      type: 'DUTCH_BOOK',
      markets: {
        polymarket: market,
      },
      positions: market.outcomes.map(outcome => ({
        market: market.id,
        side: outcome.side,
        size: (capitalRequired * outcome.price) / totalImpliedProb,
        price: outcome.price,
        expectedReturn: capitalRequired / totalImpliedProb,
      })),
      expectedProfit: guaranteedProfit,
      expectedProfitPercent: profitPercent,
      worstCaseLoss: 0, // True Dutch Book has no loss
      guaranteedProfit: guaranteedProfit,
      confidence: 95,
      validUntil: new Date(Date.now() + 60000).toISOString(), // 1 minute
      riskFactors: ['Liquidity may be insufficient', 'Prices may move'],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Cross-Platform Arbitrage Detection
   * Compare Polymarket prices with traditional betting odds
   */
  private detectCrossPlatformArb(
    polymarket: Market,
    traditional: TraditionalOdds
  ): ArbitrageOpportunity | null {
    // Try to match markets by keywords
    const polyKeywords = polymarket.question.toLowerCase().split(' ');
    const tradKeywords = traditional.market.toLowerCase().split(' ');
    
    const matchScore = polyKeywords.filter(k => 
      tradKeywords.some(t => t.includes(k) || k.includes(t))
    ).length;

    // Require at least 2 matching keywords
    if (matchScore < 2) {
      return null;
    }

    // Find best arbitrage combination
    let bestArb: ArbitrageOpportunity | null = null;
    let bestProfit = 0;

    for (const polyOutcome of polymarket.outcomes) {
      for (const tradOutcome of traditional.outcomes) {
        // Check if outcomes are opposite (YES on Poly, NO on traditional, or vice versa)
        const isOpposite = this.areOutcomesOpposite(polyOutcome.name, tradOutcome.name);
        
        if (isOpposite) {
          const polyProb = polyOutcome.price;
          const tradProb = tradOutcome.impliedProbability;
          
          // Arbitrage exists if: polyProb + tradProb < 1
          const totalProb = polyProb + tradProb;
          
          if (totalProb < 0.98) { // Account for fees
            const profitPercent = (1 - totalProb) * 100;
            
            if (profitPercent > bestProfit) {
              bestProfit = profitPercent;
              bestArb = {
                id: `cross-${polymarket.id}-${Date.now()}`,
                type: 'CROSS_PLATFORM',
                markets: {
                  polymarket,
                  traditional,
                },
                positions: [
                  {
                    market: 'polymarket',
                    side: polyOutcome.side,
                    size: 500,
                    price: polyOutcome.price,
                    expectedReturn: 500 / polyOutcome.price,
                  },
                  {
                    market: traditional.bookmaker,
                    side: tradOutcome.name,
                    size: 500,
                    price: 1 / tradOutcome.odds,
                    expectedReturn: 500 * tradOutcome.odds,
                  },
                ],
                expectedProfit: 1000 * (1 - totalProb),
                expectedProfitPercent: profitPercent,
                worstCaseLoss: 0,
                guaranteedProfit: 1000 * (1 - totalProb),
                confidence: 70 + matchScore * 5,
                validUntil: new Date(Date.now() + 30000).toISOString(),
                riskFactors: [
                  'Markets may not be exactly equivalent',
                  'Settlement rules may differ',
                  'Execution timing risk',
                ],
                createdAt: new Date().toISOString(),
              };
            }
          }
        }
      }
    }

    return bestArb;
  }

  /**
   * Check if two outcomes are semantically opposite
   */
  private areOutcomesOpposite(outcome1: string, outcome2: string): boolean {
    const o1 = outcome1.toLowerCase();
    const o2 = outcome2.toLowerCase();

    // Direct opposites
    if ((o1 === 'yes' && o2 === 'no') || (o1 === 'no' && o2 === 'yes')) {
      return true;
    }

    // Team vs opponent
    if (o1 !== o2 && !o1.includes(o2) && !o2.includes(o1)) {
      return true;
    }

    return false;
  }

  /**
   * Hedge Arbitrage Detection
   * Find opportunities to hedge positions with bounded loss
   */
  detectHedgeArb(
    market: Market,
    existingPosition?: { side: string; price: number; size: number }
  ): ArbitrageOpportunity | null {
    if (!existingPosition) return null;

    const oppositeOutcome = market.outcomes.find(o => o.side !== existingPosition.side);
    if (!oppositeOutcome) return null;

    // Calculate hedge ratios
    const hedgeSize = (existingPosition.size * existingPosition.price) / oppositeOutcome.price;
    const totalInvestment = existingPosition.size + hedgeSize;

    // Calculate worst case
    const worstCaseReturn = Math.min(
      existingPosition.size / existingPosition.price,
      hedgeSize / oppositeOutcome.price
    );

    const worstCaseLoss = totalInvestment - worstCaseReturn;
    
    if (worstCaseLoss > 0) {
      return null; // Not a true arbitrage
    }

    return {
      id: `hedge-${market.id}-${Date.now()}`,
      type: 'HEDGE_ARB',
      markets: { polymarket: market },
      positions: [
        {
          market: market.id,
          side: existingPosition.side,
          size: existingPosition.size,
          price: existingPosition.price,
          expectedReturn: existingPosition.size / existingPosition.price,
        },
        {
          market: market.id,
          side: oppositeOutcome.side,
          size: hedgeSize,
          price: oppositeOutcome.price,
          expectedReturn: hedgeSize / oppositeOutcome.price,
        },
      ],
      expectedProfit: Math.abs(worstCaseLoss),
      expectedProfitPercent: (Math.abs(worstCaseLoss) / totalInvestment) * 100,
      worstCaseLoss: 0,
      guaranteedProfit: Math.abs(worstCaseLoss),
      confidence: 85,
      validUntil: new Date(Date.now() + 60000).toISOString(),
      riskFactors: ['Price movement before execution'],
      createdAt: new Date().toISOString(),
    };
  }
}
