/**
 * WebSocket Client for Real-Time Bidirectional Communication
 *
 * Handles WebSocket connections to /api/isp/v1/admin/realtime/ws endpoints with:
 * - JWT authentication (query param, header, cookie)
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong for connection health
 * - Event subscription management
 * - Control commands (cancel, pause, resume)
 */

import {
  ConnectionStatus,
  type BaseEvent,
  type EventHandler,
  type EventType,
  type WebSocketClientMessage,
  type WebSocketConfig,
  type WebSocketMessageType,
  type WebSocketServerMessage,
} from "../../types/realtime";

const isDev = process.env["NODE_ENV"] !== "production";

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly baseReconnectInterval = 1000; // 1 second
  private lastPongTime: number | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      protocols: [],
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000, // 30 seconds
      ...config,
    };
  }

  /**
   * Connect to WebSocket endpoint
   */
  connect(): void {
    if (this.ws) {
      this.close();
    }

    this.status = ConnectionStatus.CONNECTING;

    try {
      // Build WebSocket URL with token as query parameter
      const wsUrl = this.buildWebSocketUrl();

      this.ws = new WebSocket(wsUrl, this.config.protocols);

      this.ws.onopen = () => {
        this.status = ConnectionStatus.CONNECTED;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        if (this.config.onOpen) {
          this.config.onOpen();
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        this.status = ConnectionStatus.ERROR;
        console.error("WebSocket error:", error);

        if (this.config.onError) {
          this.config.onError(error);
        }
      };

      this.ws.onclose = (event) => {
        this.status = ConnectionStatus.DISCONNECTED;
        this.stopHeartbeat();

        if (this.config.onClose) {
          this.config.onClose(event);
        }

        // Attempt reconnection if configured
        if (
          this.config.reconnect &&
          this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)
        ) {
          this.reconnect();
        }
      };
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      console.error("WebSocket connection error:", error);
      if (this.config.onError) {
        this.config.onError(error as Event);
      }
    }
  }

  /**
   * Build WebSocket URL with authentication
   *
   * Note: Cookies ARE sent during the WebSocket HTTP upgrade handshake
   * (same-origin policy). No token query param needed - httpOnly cookies
   * are automatically included in the upgrade request headers.
   */
  private buildWebSocketUrl(): string {
    // Convert HTTP(S) URL to WS(S)
    const wsUrl = this.config.endpoint.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const url = new URL(wsUrl, window.location.origin);
    // No token param needed - cookies sent with upgrade request
    return url.toString();
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketServerMessage | BaseEvent = JSON.parse(event.data);

      // Handle system messages
      if ("type" in message) {
        this.handleSystemMessage(message as WebSocketServerMessage);
      }

      // Handle event messages
      if ("event_type" in message) {
        this.handleEventMessage(message as BaseEvent);
      }

      // Call generic message handler
      if (this.config.onMessage) {
        this.config.onMessage(message);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  /**
   * Handle system/control messages
   */
  private handleSystemMessage(message: WebSocketServerMessage): void {
    switch (message.type) {
      case "pong":
        this.lastPongTime = Date.now();
        break;
      case "subscribed":
        if (isDev) console.log("Subscribed to channel:", message.channel);
        break;
      case "error":
        console.error("WebSocket error message:", message.message);
        break;
      default:
        // Unknown system message
        break;
    }
  }

  /**
   * Handle event messages
   */
  private handleEventMessage(event: BaseEvent): void {
    const eventType = event.event_type;

    // Call specific event handlers
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }

    // Call wildcard handlers (*)
    const wildcardHandlers = this.eventHandlers.get("*");
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error("Error in wildcard event handler:", error);
        }
      });
    }
  }

  /**
   * Subscribe to specific event type
   */
  subscribe<T extends BaseEvent>(
    eventType: EventType | string,
    handler: EventHandler<T>,
  ): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Send message to server
   */
  send(message: WebSocketClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
    }
  }

  /**
   * Start heartbeat (ping-pong)
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping" as WebSocketMessageType });
      }
    }, this.config.heartbeatInterval || 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reconnect to WebSocket endpoint
   */
  reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.status = ConnectionStatus.RECONNECTING;
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = this.baseReconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimeout = setTimeout(
      () => {
        this.connect();
      },
      Math.min(delay, 30000),
    ); // Max 30 seconds
  }

  /**
   * Close WebSocket connection
   */
  close(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = ConnectionStatus.DISCONNECTED;
    this.eventHandlers.clear();
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection latency (milliseconds)
   */
  getLatency(): number | null {
    if (!this.lastPongTime) return null;
    return Date.now() - this.lastPongTime;
  }
}

/**
 * Create WebSocket client for specific endpoint
 */
export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
  const client = new WebSocketClient(config);
  client.connect();
  return client;
}

/**
 * WebSocket endpoint factory
 *
 * Authentication is handled via httpOnly cookies sent during the
 * WebSocket HTTP upgrade handshake. No token parameter needed.
 */
export class WebSocketEndpoints {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create RADIUS sessions WebSocket client
   */
  sessions(config?: Partial<WebSocketConfig>): WebSocketClient {
    return createWebSocketClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/ws/sessions`,
      ...config,
    });
  }

  /**
   * Create job progress WebSocket client
   */
  job(jobId: string, config?: Partial<WebSocketConfig>): WebSocketClient {
    return createWebSocketClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/ws/jobs/${jobId}`,
      ...config,
    });
  }

  /**
   * Create campaign progress WebSocket client
   */
  campaign(campaignId: string, config?: Partial<WebSocketConfig>): WebSocketClient {
    return createWebSocketClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/ws/campaigns/${campaignId}`,
      ...config,
    });
  }
}

/**
 * Job control commands
 */
export class JobControl {
  constructor(private client: WebSocketClient) {}

  cancel(): void {
    this.client.send({ type: "cancel_job" as WebSocketMessageType });
  }

  pause(): void {
    this.client.send({ type: "pause_job" as WebSocketMessageType });
  }

  resume(): void {
    this.client.send({ type: "resume_job" as WebSocketMessageType });
  }
}

/**
 * Campaign control commands
 */
export class CampaignControl {
  constructor(private client: WebSocketClient) {}

  cancel(): void {
    this.client.send({ type: "cancel_campaign" as WebSocketMessageType });
  }

  pause(): void {
    this.client.send({ type: "pause_campaign" as WebSocketMessageType });
  }

  resume(): void {
    this.client.send({ type: "resume_campaign" as WebSocketMessageType });
  }
}
