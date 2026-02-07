/**
 * The Odds API Service - Traditional Betting Odds
 */

import type { TraditionalOdds } from '../core/types';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export class OddsApiService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ODDS_API_KEY || '';
  }

  async getOdds(sport: string): Promise<TraditionalOdds[]> {
    if (!this.apiKey) {
      console.warn('[OddsAPI] No API key configured, using mock data');
      return this.getMockOdds(sport);
    }

    try {
      const url = new URL(`${ODDS_API_BASE}/sports/${sport}/odds`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('regions', 'us,uk,eu');
      url.searchParams.set('markets', 'h2h');
      url.searchParams.set('oddsFormat', 'decimal');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Odds API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformOdds(data);
    } catch (error) {
      console.error('[OddsAPI] Failed to fetch odds:', error);
      return this.getMockOdds(sport);
    }
  }

  async getAllOdds(): Promise<TraditionalOdds[]> {
    const sports = ['americanfootball_nfl', 'basketball_nba', 'soccer_epl'];
    const results: TraditionalOdds[] = [];

    for (const sport of sports) {
      const odds = await this.getOdds(sport);
      results.push(...odds);
    }

    return results;
  }

  private transformOdds(data: any[]): TraditionalOdds[] {
    return data.map(event => {
      const bookmaker = event.bookmakers?.[0];
      const market = bookmaker?.markets?.find((m: any) => m.key === 'h2h');
      
      return {
        bookmaker: bookmaker?.title || 'Unknown',
        market: event.sport_title || event.sport_key,
        outcomes: (market?.outcomes || []).map((outcome: any) => ({
          name: outcome.name,
          odds: outcome.price,
          impliedProbability: 1 / outcome.price,
        })),
        timestamp: new Date().toISOString(),
      };
    });
  }

  private getMockOdds(sport: string): TraditionalOdds[] {
    const mockData: Record<string, TraditionalOdds[]> = {
      americanfootball_nfl: [
        {
          bookmaker: 'Pinnacle',
          market: 'NFL',
          outcomes: [
            { name: 'Kansas City Chiefs', odds: 4.20, impliedProbability: 0.238 },
            { name: 'San Francisco 49ers', odds: 5.50, impliedProbability: 0.182 },
            { name: 'Philadelphia Eagles', odds: 8.00, impliedProbability: 0.125 },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      basketball_nba: [
        {
          bookmaker: 'Bet365',
          market: 'NBA Championship',
          outcomes: [
            { name: 'Boston Celtics', odds: 3.50, impliedProbability: 0.286 },
            { name: 'Denver Nuggets', odds: 5.00, impliedProbability: 0.200 },
            { name: 'Milwaukee Bucks', odds: 7.50, impliedProbability: 0.133 },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      soccer_epl: [
        {
          bookmaker: 'Betfair',
          market: 'Premier League Winner',
          outcomes: [
            { name: 'Manchester City', odds: 1.65, impliedProbability: 0.606 },
            { name: 'Arsenal', odds: 4.00, impliedProbability: 0.250 },
            { name: 'Liverpool', odds: 6.00, impliedProbability: 0.167 },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      default: [
        {
          bookmaker: 'Generic',
          market: sport,
          outcomes: [
            { name: 'Team A', odds: 2.00, impliedProbability: 0.500 },
            { name: 'Team B', odds: 2.00, impliedProbability: 0.500 },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    return mockData[sport] || mockData.default;
  }
}
