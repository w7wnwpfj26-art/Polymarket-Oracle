import { ref, onMounted, onUnmounted } from 'vue';

interface WSMessage {
  type: 'status' | 'opportunity' | 'trade' | 'agent' | 'error' | 'heartbeat';
  data: any;
  timestamp: string;
}

export function useWebSocket(url: string) {
  const socket = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;
  const handleMessageCallback = ref<(message: WSMessage) => void>(() => {});

  const connect = () => {
    try {
      socket.value = new WebSocket(url);
      
      socket.value.onopen = () => {
        console.log('[WebSocket] Connected');
        isConnected.value = true;
        reconnectAttempts.value = 0;
      };

      socket.value.onclose = () => {
        console.log('[WebSocket] Disconnected');
        isConnected.value = false;
        attemptReconnect();
      };

      socket.value.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        isConnected.value = false;
      };

      socket.value.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleMessage(message);
          handleMessageCallback.value(message);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      attemptReconnect();
    }
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.close();
      socket.value = null;
    }
  };

  const sendMessage = (message: any) => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(message));
    }
  };

  const subscribe = (channels: string[]) => {
    sendMessage({
      type: 'subscribe',
      channels,
    });
  };

  const attemptReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++;
      console.log(`[WebSocket] Attempting to reconnect (${reconnectAttempts.value}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        connect();
      }, Math.min(1000 * 2 ** reconnectAttempts.value, 10000)); // 指数退避，最大10秒
    } else {
      console.error('[WebSocket] Max reconnection attempts reached');
    }
  };

  const handleMessage = (message: WSMessage) => {
    // 默认处理函数
    console.log('[WebSocket] Received:', message.type, message.data);
  };

  const onMessage = (callback: (message: WSMessage) => void) => {
    handleMessageCallback.value = callback;
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    onMessage,
  };
}