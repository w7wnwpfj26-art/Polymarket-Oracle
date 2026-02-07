/**
 * WebSocket Service - Real-time updates
 * Works with Node.js using 'ws' package
 */

import { WebSocketServer, WebSocket } from 'ws';
import logger from '../utils/logger';

// Message types
export interface WSMessage {
  type: 'status' | 'opportunity' | 'trade' | 'agent' | 'market' | 'error' | 'heartbeat' | 'stats';
  data: unknown;
  timestamp: string;
}

// Client info
interface ClientInfo {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastPing: number;        // 上次收到ping的时间
  missedPongs: number;     // 错过的pong次数
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  start(port: number = 7701) {
    if (this.wss) {
      logger.websocket.warn('WebSocket server already running');
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws, req) => {
      const clientId = crypto.randomUUID();
      const clientInfo: ClientInfo = {
        ws,
        id: clientId,
        subscriptions: new Set(['all']), // Subscribe to all by default
        connectedAt: new Date(),
        lastPing: Date.now(),
        missedPongs: 0,
      };

      this.clients.set(clientId, clientInfo);
      logger.websocket.info('Client connected', { clientId, total: this.clients.size });

      // Send welcome message
      this.send(ws, {
        type: 'status',
        data: {
          connected: true,
          clientId,
          message: '已连接到 AEGIS 实时数据服务',
          channels: ['status', 'opportunity', 'trade', 'agent', 'market', 'stats'],
        },
        timestamp: new Date().toISOString(),
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientInfo, message);
        } catch (error) {
          logger.websocket.error('Failed to parse message', { error: (error as Error).message });
        }
      });

      // Handle pong responses (for heartbeat)
      ws.on('pong', () => {
        clientInfo.lastPing = Date.now();
        clientInfo.missedPongs = 0;
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.websocket.info('Client disconnected', { clientId, total: this.clients.size });
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.websocket.error('Client error', { clientId, error: error.message });
        this.clients.delete(clientId);
      });
    });

    this.wss.on('error', (error) => {
      logger.websocket.error('WebSocket server error', { error: error.message });
    });

    // Start heartbeat
    this.startHeartbeat();

    logger.websocket.info('WebSocket server started', { port });
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    logger.websocket.info('WebSocket server stopped');
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(client: ClientInfo, message: any) {
    switch (message.type) {
      case 'ping':
        this.send(client.ws, {
          type: 'heartbeat',
          data: { pong: true, serverTime: Date.now() },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'subscribe':
        if (Array.isArray(message.channels)) {
          message.channels.forEach((ch: string) => client.subscriptions.add(ch));
          logger.websocket.info('Client subscribed', { 
            clientId: client.id, 
            channels: Array.from(client.subscriptions) 
          });
        }
        break;

      case 'unsubscribe':
        if (Array.isArray(message.channels)) {
          message.channels.forEach((ch: string) => client.subscriptions.delete(ch));
        }
        break;

      default:
        logger.websocket.warn('Unknown message type', { type: message.type });
    }
  }

  /**
   * Send message to single client
   */
  private send(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast to all clients with matching subscription
   */
  broadcast(message: WSMessage, channel: string = 'all') {
    const data = JSON.stringify(message);
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (client.subscriptions.has('all') || client.subscriptions.has(channel)) {
          client.ws.send(data);
          sentCount++;
        }
      }
    }

    if (sentCount > 0) {
      logger.websocket.info('Broadcast sent', { type: message.type, channel, recipients: sentCount });
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // 发送心跳给所有客户端
      this.broadcast({
        type: 'heartbeat',
        data: { 
          time: Date.now(),
          clients: this.clients.size,
        },
        timestamp: new Date().toISOString(),
      }, 'status');

      // 检查客户端超时
      const now = Date.now();
      const timeoutThreshold = 90000; // 90秒超时
      const maxMissedPongs = 3;

      for (const [clientId, client] of this.clients) {
        // 发送 ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }

        // 检查超时
        if (now - client.lastPing > timeoutThreshold || client.missedPongs >= maxMissedPongs) {
          logger.websocket.warn('Client timeout, closing connection', { 
            clientId, 
            lastPing: client.lastPing,
            missedPongs: client.missedPongs
          });
          
          // 关闭连接
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Connection timeout');
          }
          this.clients.delete(clientId);
        } else if (now - client.lastPing > 30000) {
          // 30秒未收到pong，增加missed计数
          client.missedPongs++;
        }
      }
    }, 30000); // 每30秒执行一次
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client info
   */
  getClients(): Array<{ id: string; connectedAt: Date; subscriptions: string[] }> {
    return Array.from(this.clients.values()).map(c => ({
      id: c.id,
      connectedAt: c.connectedAt,
      subscriptions: Array.from(c.subscriptions),
    }));
  }

  // ============ Broadcast Helpers ============

  broadcastStatus(status: unknown) {
    this.broadcast({
      type: 'status',
      data: status,
      timestamp: new Date().toISOString(),
    }, 'status');
  }

  broadcastOpportunity(opportunity: unknown) {
    this.broadcast({
      type: 'opportunity',
      data: opportunity,
      timestamp: new Date().toISOString(),
    }, 'opportunity');
  }

  broadcastTrade(trade: unknown) {
    this.broadcast({
      type: 'trade',
      data: trade,
      timestamp: new Date().toISOString(),
    }, 'trade');
  }

  broadcastAgentDecision(agentId: string, decision: unknown) {
    this.broadcast({
      type: 'agent',
      data: { agentId, decision },
      timestamp: new Date().toISOString(),
    }, 'agent');
  }

  broadcastMarketUpdate(market: unknown) {
    this.broadcast({
      type: 'market',
      data: market,
      timestamp: new Date().toISOString(),
    }, 'market');
  }

  broadcastStats(stats: unknown) {
    this.broadcast({
      type: 'stats',
      data: stats,
      timestamp: new Date().toISOString(),
    }, 'stats');
  }

  broadcastError(error: unknown) {
    this.broadcast({
      type: 'error',
      data: error,
      timestamp: new Date().toISOString(),
    }, 'all');
  }
}

// Export singleton
export const wsService = new WebSocketService();
export default wsService;
