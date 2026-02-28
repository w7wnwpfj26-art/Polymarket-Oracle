/**
 * Demo Data Seeder - Populate database with realistic sample data
 * Usage: npm run seed-demo (add to package.json)
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../backend/data/aegis.db');

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

console.log('🌱 Seeding demo data...\n');

// Sample markets
const markets = [
  {
    id: 'demo-market-1',
    question: 'Will Bitcoin reach $100k by end of 2026?',
    description: 'Resolves YES if BTC/USD reaches $100,000 on any major exchange',
    source: 'polymarket',
    outcomes_json: JSON.stringify(['YES', 'NO']),
    end_date: '2026-12-31T23:59:59Z',
    status: 'active',
    metadata_json: JSON.stringify({ volume: 1250000, liquidity: 350000 }),
  },
  {
    id: 'demo-market-2',
    question: 'Will AI replace 50% of jobs by 2030?',
    description: 'Based on World Economic Forum report',
    source: 'polymarket',
    outcomes_json: JSON.stringify(['YES', 'NO']),
    end_date: '2030-01-01T00:00:00Z',
    status: 'active',
    metadata_json: JSON.stringify({ volume: 875000, liquidity: 220000 }),
  },
  {
    id: 'demo-market-3',
    question: 'Lakers to win NBA Championship 2026',
    source: 'traditional_betting',
    outcomes_json: JSON.stringify(['YES', 'NO']),
    end_date: '2026-06-30T23:59:59Z',
    status: 'active',
    metadata_json: JSON.stringify({ odds: { yes: 1.85, no: 2.10 } }),
  },
];

console.log('📊 Creating markets...');
const insertMarket = db.prepare(`
  INSERT OR REPLACE INTO markets (id, question, description, source, outcomes_json, end_date, status, metadata_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

for (const market of markets) {
  insertMarket.run(
    market.id,
    market.question,
    market.description,
    market.source,
    market.outcomes_json,
    market.end_date,
    market.status,
    market.metadata_json
  );
}
console.log(`   ✅ Created ${markets.length} markets\n`);

// Sample arbitrage opportunities
const opportunities = [
  {
    id: 'demo-opp-1',
    type: 'dutch_book',
    markets_json: JSON.stringify(['demo-market-1', 'demo-market-3']),
    profit_margin: 3.5,
    required_capital: 1000,
    expected_profit: 35,
    risk_score: 15,
    confidence: 0.92,
    status: 'identified',
    strategy_json: JSON.stringify({
      legs: [
        { market: 'demo-market-1', side: 'YES', amount: 500, price: 0.48 },
        { market: 'demo-market-3', side: 'NO', amount: 500, price: 0.54 },
      ],
    }),
  },
  {
    id: 'demo-opp-2',
    type: 'cross_market',
    markets_json: JSON.stringify(['demo-market-2']),
    profit_margin: 2.1,
    required_capital: 500,
    expected_profit: 10.5,
    risk_score: 25,
    confidence: 0.85,
    status: 'expired',
    strategy_json: JSON.stringify({ note: 'Window closed too quickly' }),
  },
];

console.log('💰 Creating arbitrage opportunities...');
const insertOpp = db.prepare(`
  INSERT OR REPLACE INTO opportunities (id, type, markets_json, profit_margin, required_capital, expected_profit, risk_score, confidence, status, strategy_json, detected_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'), datetime('now', '+1 hour'))
`);

for (const opp of opportunities) {
  insertOpp.run(
    opp.id,
    opp.type,
    opp.markets_json,
    opp.profit_margin,
    opp.required_capital,
    opp.expected_profit,
    opp.risk_score,
    opp.confidence,
    opp.status,
    opp.strategy_json
  );
}
console.log(`   ✅ Created ${opportunities.length} opportunities\n`);

// Sample agent decisions
const agentDecisions = [
  {
    opportunity_id: 'demo-opp-1',
    agent_name: 'semanticJudge',
    decision: 'approve',
    reasoning: 'Market descriptions are clear and unambiguous. No semantic risks detected.',
    risk_score: 10,
    confidence: 0.95,
  },
  {
    opportunity_id: 'demo-opp-1',
    agent_name: 'irreversibilityVerifier',
    decision: 'approve',
    reasoning: 'Event outcome is verifiable via public blockchain data. High certainty.',
    risk_score: 5,
    confidence: 0.98,
  },
  {
    opportunity_id: 'demo-opp-1',
    agent_name: 'nonTradeAgent',
    decision: 'approve',
    reasoning: 'Market conditions favorable. No red flags indicating avoidance.',
    risk_score: 15,
    confidence: 0.88,
  },
];

console.log('🤖 Recording agent decisions...');
const insertDecision = db.prepare(`
  INSERT INTO agent_decisions (opportunity_id, agent_name, decision, reasoning, risk_score, confidence, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

for (const decision of agentDecisions) {
  insertDecision.run(
    decision.opportunity_id,
    decision.agent_name,
    decision.decision,
    decision.reasoning,
    decision.risk_score,
    decision.confidence
  );
}
console.log(`   ✅ Recorded ${agentDecisions.length} agent decisions\n`);

// Sample trade execution
console.log('📈 Creating sample trade history...');
db.prepare(`
  INSERT INTO trades (
    id, opportunity_id, market_id, side, amount, price, status, 
    execution_time, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'), ?)
`).run(
  'demo-trade-1',
  'demo-opp-1',
  'demo-market-1',
  'BUY',
  500,
  0.48,
  'SIMULATED',
  JSON.stringify({ note: 'Demo trade - no real funds used' })
);
console.log('   ✅ Created 1 sample trade\n');

// Sample system logs
console.log('📝 Adding system logs...');
const logs = [
  { level: 'INFO', category: 'system', message: 'Demo data seeding started', data_json: '{}' },
  { level: 'INFO', category: 'agent', message: 'Semantic Judge analyzed market demo-market-1', data_json: JSON.stringify({ risk: 10 }) },
  { level: 'WARN', category: 'trade', message: 'Opportunity demo-opp-2 expired before execution', data_json: '{}' },
];

const insertLog = db.prepare(`
  INSERT INTO system_logs (level, category, message, data_json, timestamp)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

for (const log of logs) {
  insertLog.run(log.level, log.category, log.message, log.data_json);
}
console.log(`   ✅ Added ${logs.length} log entries\n`);

db.close();

console.log('✅ Demo data seeding complete!\n');
console.log('You can now:');
console.log('  1. Start the backend: cd backend && npm run dev');
console.log('  2. Start the frontend: cd frontend && npm run dev');
console.log('  3. Visit http://localhost:5173 and see the demo data\n');
console.log('💡 Tip: All data is marked as "demo" or "simulated" - no real trading occurred.');
