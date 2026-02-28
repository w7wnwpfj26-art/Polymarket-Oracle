# AEGIS Arbitrage System - Architecture

## Overview

AEGIS is a multi-agent prediction market arbitrage system built with:
- **Backend**: Hono + Node.js + SQLite
- **Frontend**: Vue 3 + Vite + Tailwind CSS 4
- **Desktop**: Electron (optional)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Web / Electron)                                      │
│  - Dashboard, Markets, Arbitrage, Config                       │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────┐
│  Backend (Hono API)                                           │
│  - REST API, WebSocket, Auth, Rate Limiting                    │
│  - Arbitrage Detector, AI Agents, Trade Execution             │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│  External Services                                             │
│  - Polymarket, Kalshi, Odds API                               │
│  - OpenAI/Claude, Telegram, Twitter, Reddit, NewsAPI          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Arbitrage Detection
- Dutch Book detection across markets
- Cross-market arbitrage (Polymarket ↔ Kalshi ↔ Traditional)
- Real-time price monitoring via WebSocket

### AI Agent System
- **Semantic Judge**: Semantic risk analysis
- **Irreversibility Verifier**: Event irreversibility check
- **Arbitrage Constructor**: Strategy construction
- **Non-Trade Agent**: When-not-to-trade decisions
- **Red Team Simulator**: Adversarial simulation
- **Fail-Safe Monitor**: Anomaly detection

### Data Flow
1. Config → `backend/data/config.json` (gitignored)
2. Secrets → `.env` (gitignored)
3. API keys → env vars or config UI, never committed

## Security

- JWT + API key auth
- PBKDF2 password hashing
- Rate limiting (1000/min localhost, 200/min production)
- No hardcoded secrets; all from env vars

## See Also

- [SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md) - Detailed system overview
- [API_KEYS_SETUP.md](../API_KEYS_SETUP.md) - API key configuration
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Deployment instructions
