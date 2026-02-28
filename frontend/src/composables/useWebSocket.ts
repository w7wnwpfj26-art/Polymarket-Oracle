/**
 * WebSocket Composable - 实时数据推送
 */
import { ref, readonly, onUnmounted } from 'vue';

export type WSMessage = {
  type: string;
  data: any;
  timestamp: string;
};

type MessageHandler = (msg: WSMessage) => void;

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:7701';

// 全局共享的 WebSocket 实例
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 5000; // 5 seconds
const handlers = new Map<string, Set<MessageHandler>>();
const isConnected = ref(false);
const lastMessage = ref<WSMessage | null>(null);
const reconnectFailed = ref(false);
const reconnectAttemptsCount = ref(0);
const lastHeartbeat = ref<number>(0);

function startHeartbeat() {
  stopHeartbeat();
  
  heartbeatTimer = setInterval(() => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      // Send ping
      send('ping', { timestamp: Date.now() });
      
      // Set timeout for pong response
      heartbeatTimeoutTimer = setTimeout(() => {
        console.warn('[WS] Heartbeat timeout, reconnecting...');
        globalWs?.close();
      }, HEARTBEAT_TIMEOUT);
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (heartbeatTimeoutTimer) {
    clearTimeout(heartbeatTimeoutTimer);
    heartbeatTimeoutTimer = null;
  }
}

function connect() {
  if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    globalWs = new WebSocket(WS_URL);

    globalWs.onopen = () => {
      isConnected.value = true;
      reconnectAttempts = 0;
      reconnectFailed.value = false;
      reconnectAttemptsCount.value = 0;
      startHeartbeat();
      console.log('[WS] Connected successfully');
    };

    globalWs.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        lastMessage.value = msg;

        // Handle pong response
        if (msg.type === 'pong') {
          lastHeartbeat.value = Date.now();
          if (heartbeatTimeoutTimer) {
            clearTimeout(heartbeatTimeoutTimer);
            heartbeatTimeoutTimer = null;
          }
          return;
        }

        // Dispatch to type-specific handlers
        const typeHandlers = handlers.get(msg.type);
        if (typeHandlers) {
          typeHandlers.forEach(handler => handler(msg));
        }

        // Dispatch to wildcard handlers
        const wildcardHandlers = handlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach(handler => handler(msg));
        }
      } catch {
        // Not JSON, ignore
      }
    };

    globalWs.onclose = () => {
      isConnected.value = false;
      globalWs = null;
      stopHeartbeat();
      console.log('[WS] Connection closed');
      scheduleReconnect();
    };

    globalWs.onerror = (error) => {
      isConnected.value = false;
      console.error('[WS] Error occurred:', error);
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    reconnectFailed.value = true;
    reconnectAttemptsCount.value = reconnectAttempts;
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  reconnectAttemptsCount.value = reconnectAttempts;
  reconnectTimer = setTimeout(connect, delay);
}

function send(type: string, data: any) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
  }
}

/**
 * WebSocket composable
 * Usage:
 *   const { isConnected, onMessage, subscribe } = useWebSocket()
 *   subscribe('arbitrage:update', (msg) => { ... })
 */
export function useWebSocket() {
  // Auto-connect on first use
  if (!globalWs) connect();

  function subscribe(type: string, handler: MessageHandler) {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    handlers.get(type)!.add(handler);

    // Cleanup on unmount
    onUnmounted(() => {
      handlers.get(type)?.delete(handler);
      if (handlers.get(type)?.size === 0) {
        handlers.delete(type);
      }
    });
  }

  function onMessage(handler: MessageHandler) {
    subscribe('*', handler);
  }

  function retryConnect() {
    reconnectAttempts = 0;
    reconnectFailed.value = false;
    connect();
  }

  return {
    isConnected,
    lastMessage,
    lastHeartbeat: readonly(lastHeartbeat),
    reconnectFailed,
    reconnectAttemptsCount: readonly(reconnectAttemptsCount),
    subscribe,
    onMessage,
    send,
    connect,
    retryConnect,
  };
}
