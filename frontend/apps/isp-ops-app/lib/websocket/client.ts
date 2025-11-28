/**
 * WebSocket Client for Real-Time Monitoring
 *
 * Provides WebSocket connection management for receiving real-time updates
 * from network monitoring, alerts, and diagnostic events.
 */

export enum WebSocketEventType {
  // Network monitoring events
  DEVICE_STATUS_CHANGED = "device_status_changed",
  DEVICE_METRICS_UPDATE = "device_metrics_update",
  NETWORK_ALERT = "network_alert",

  // Diagnostic events
  DIAGNOSTIC_STARTED = "diagnostic_started",
  DIAGNOSTIC_COMPLETED = "diagnostic_completed",
  DIAGNOSTIC_FAILED = "diagnostic_failed",

  // System events
  SYSTEM_HEALTH_UPDATE = "system_health_update",
  CONNECTION_STATE = "connection_state",
}

export interface WebSocketMessage<T = any> {
  event: WebSocketEventType | string;
  data: T;
  timestamp: string;
  tenant_id?: string;
}

export interface WebSocketConnectionState {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
}

type MessageHandler<T = any> = (message: WebSocketMessage<T>) => void;
type StateChangeHandler = (state: WebSocketConnectionState) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private stateChangeHandlers: Set<StateChangeHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private pingInterval = 30000; // Send ping every 30 seconds
  private pongWaitTime = 5000; // Wait 5 seconds for pong response
  private url: string;
  private state: WebSocketConnectionState = {
    connected: false,
    reconnecting: false,
  };

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.updateState({
        connected: false,
        reconnecting: false,
        error: error instanceof Error ? error.message : "Connection failed",
      });
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateState({ connected: false, reconnecting: false });
  }

  /**
   * Subscribe to specific event type
   */
  on<T = any>(event: WebSocketEventType | string, handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }

    this.messageHandlers.get(event)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(event);
        }
      }
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler);

    // Call handler immediately with current state
    handler(this.state);

    // Return unsubscribe function
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Send message to WebSocket server
   */
  send(message: Partial<WebSocketMessage>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      console.warn("WebSocket is not connected. Message not sent:", message);
    }
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketConnectionState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  private handleOpen(): void {
    if (process.env["NODE_ENV"] !== "production") {
      console.log("WebSocket connected");
    }
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.updateState({ connected: true, reconnecting: false });
    this.startHeartbeat();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Handle pong response (clear timeout)
      if (message.event === "pong") {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        return; // Don't broadcast pong to subscribers
      }

      // Call handlers for this specific event type
      const handlers = this.messageHandlers.get(message.event);
      if (handlers) {
        handlers.forEach((handler) => handler(message));
      }

      // Call wildcard handlers (listening to all events)
      const wildcardHandlers = this.messageHandlers.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.updateState({
      connected: false,
      reconnecting: false,
      error: "Connection error occurred",
    });
  }

  private handleClose(event: CloseEvent): void {
    if (process.env["NODE_ENV"] !== "production") {
      console.log("WebSocket closed:", event.code, event.reason);
    }
    this.updateState({ connected: false, reconnecting: false });

    // Attempt to reconnect if it wasn't a clean closure
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.updateState({ connected: false, reconnecting: true });

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    if (process.env["NODE_ENV"] !== "production") {
      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`,
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private updateState(newState: Partial<WebSocketConnectionState>): void {
    this.state = { ...this.state, ...newState };
    this.stateChangeHandlers.forEach((handler) => handler(this.state));
  }

  /**
   * Start sending periodic ping messages
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing timers

    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.send({ event: "ping" });

        // Set timeout for pong response
        this.pongTimeout = setTimeout(() => {
          console.warn("No pong received, connection may be stale. Reconnecting...");
          this.ws?.close(); // This will trigger handleClose which handles reconnection
        }, this.pongWaitTime);
      }
    }, this.pingInterval);
  }

  /**
   * Stop heartbeat timers
   */
  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Get WebSocket URL based on environment and protocol
 */
function getWebSocketUrl(): string {
  // Check for explicit environment variable first
  if (process.env["NEXT_PUBLIC_WS_URL"]) {
    return process.env["NEXT_PUBLIC_WS_URL"];
  }

  // Auto-detect based on current page protocol (for production)
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host; // includes port if present
    return `${protocol}//${host}/api/isp/v1/admin/ws`;
  }

  // SSR fallback
  return "ws://localhost:8000/api/isp/v1/admin/ws";
}

/**
 * Get or create WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl = getWebSocketUrl();
    wsClient = new WebSocketClient(wsUrl);
  }

  return wsClient;
}
