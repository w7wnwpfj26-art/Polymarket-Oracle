/**
 * WebSocket Handler for Real-time Updates
 */

import type { Context } from 'hono';
import logger from '../utils/logger';

// Connected clients
const clients = new Set<WebSocket>();

// Message types
interface WSMessage {
  type: 'status' | 'opportunity' | 'trade' | 'agent' | 'error' | 'heartbeat';
  data: unknown;
  timestamp: string;
}

export const wsHandler = async (c: Context) => {
  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }
  
  // For Bun's native WebSocket support
  const server = (c as any).env?.server;
  
  if (!server) {
    // Fallback for environments without native WebSocket
    return c.json({
      message: 'WebSocket endpoint ready',
      url: 'ws://localhost:7700/ws',
      supportedEvents: ['status', 'opportunity', 'trade', 'agent', 'error'],
    });
  }
  
  return undefined;
};

// Broadcast message to all connected clients
export function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Send status update
export function broadcastStatus(status: unknown) {
  broadcast({
    type: 'status',
    data: status,
    timestamp: new Date().toISOString(),
  });
}

// Send opportunity found
export function broadcastOpportunity(opportunity: unknown) {
  broadcast({
    type: 'opportunity',
    data: opportunity,
    timestamp: new Date().toISOString(),
  });
}

// Send trade update
export function broadcastTrade(trade: unknown) {
  broadcast({
    type: 'trade',
    data: trade,
    timestamp: new Date().toISOString(),
  });
}

// Send agent decision
export function broadcastAgentDecision(agentId: string, decision: unknown) {
  broadcast({
    type: 'agent',
    data: { agentId, decision },
    timestamp: new Date().toISOString(),
  });
}

// Send error
export function broadcastError(error: unknown) {
  broadcast({
    type: 'error',
    data: error,
    timestamp: new Date().toISOString(),
  });
}

// WebSocket server configuration for Bun
export const websocket = {
  open(ws: WebSocket) {
    clients.add(ws);
    logger.websocket.info('[WS] Client connected', { totalClients: clients.size });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'status',
      data: { connected: true, message: 'Connected to AEGIS WebSocket' },
      timestamp: new Date().toISOString(),
    }));
  },
  
  message(ws: WebSocket, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          data: { pong: true },
          timestamp: new Date().toISOString(),
        }));
      }
      
      // Handle subscription requests
      if (data.type === 'subscribe') {
        logger.websocket.info('[WS] Client subscribed', { channels: data.channels });
      }
    } catch (error) {
      logger.websocket.error('[WS] Failed to parse message', { error });
    }
  },
  
  close(ws: WebSocket) {
    clients.delete(ws);
    logger.websocket.info('[WS] Client disconnected', { totalClients: clients.size });
  },
  
  error(ws: WebSocket, error: Error) {
    logger.websocket.error('[WS] Error occurred', { error });
    clients.delete(ws);
  },
};

// Start heartbeat interval
setInterval(() => {
  broadcast({
    type: 'heartbeat',
    data: { time: Date.now() },
    timestamp: new Date().toISOString(),
  });
}, 30000); // Every 30 seconds
