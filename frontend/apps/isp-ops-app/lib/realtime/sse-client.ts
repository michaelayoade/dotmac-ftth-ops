/**
 * Server-Sent Events (SSE) Client
 *
 * Handles SSE connections to /api/isp/v1/admin/realtime endpoints with:
 * - JWT authentication
 * - Automatic reconnection
 * - Event subscription management
 * - Type-safe event handlers
 */

import {
  ConnectionStatus,
  type BaseEvent,
  type EventHandler,
  type EventType,
  SSEConfig,
} from "../../types/realtime";

export class SSEClient {
  private eventSource: EventSource | null = null;
  private config: SSEConfig;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectInterval = 1000; // 1 second

  constructor(config: SSEConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      ...config,
    };
  }

  /**
   * Connect to SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.close();
    }

    this.status = ConnectionStatus.CONNECTING;

    try {
      // EventSource doesn't support custom headers, so we rely on cookies.
      // withCredentials: true automatically sends httpOnly cookies with the request.
      // No token query param needed - cookies handle authentication.
      const url = new URL(this.config.endpoint, window.location.origin);

      this.eventSource = new EventSource(url.toString(), {
        withCredentials: true, // Send cookies automatically
      });

      this.eventSource.onopen = () => {
        this.status = ConnectionStatus.CONNECTED;
        this.reconnectAttempts = 0;
        if (this.config.onOpen) {
          this.config.onOpen();
        }
      };

      this.eventSource.onerror = (error) => {
        this.status = ConnectionStatus.ERROR;
        if (this.config.onError) {
          this.config.onError(error);
        }

        // Attempt reconnection if configured
        if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

      // Listen for all event types
      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      // Set up specific event listeners for known event types
      this.setupEventListeners();
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      console.error("SSE connection error:", error);
      if (this.config.onError) {
        this.config.onError(error as Event);
      }
    }
  }

  /**
   * Set up listeners for all event types
   */
  private setupEventListeners(): void {
    if (!this.eventSource) return;

    // We'll dynamically add listeners as subscriptions are made
    // This is handled in the subscribe method
  }

  /**
   * Handle incoming SSE message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: BaseEvent = JSON.parse(event.data);
      const eventType = data.event_type || event.type;

      // Call generic event handler if configured
      if (this.config.onEvent) {
        this.config.onEvent(event);
      }

      // Call specific event handlers
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(data);
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
            handler(data);
          } catch (error) {
            console.error("Error in wildcard event handler:", error);
          }
        });
      }
    } catch (error) {
      console.error("Error parsing SSE message:", error);
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

      // Add EventSource event listener for this type
      if (this.eventSource && eventType !== "*") {
        this.eventSource.addEventListener(eventType, (event) => {
          this.handleMessage(event as MessageEvent);
        });
      }
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
   * Reconnect to SSE endpoint
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
   * Close SSE connection
   */
  close(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
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
    return this.status === "connected";
  }
}

/**
 * Create SSE client for specific endpoint
 */
export function createSSEClient(config: SSEConfig): SSEClient {
  const client = new SSEClient(config);
  client.connect();
  return client;
}

/**
 * SSE endpoint factory
 *
 * Authentication is handled via httpOnly cookies (withCredentials: true).
 * No token parameter needed - cookies are sent automatically.
 */
export class SSEEndpoints {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create ONU status SSE client
   */
  onuStatus(config?: Partial<SSEConfig>): SSEClient {
    return createSSEClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/onu-status`,
      ...config,
    });
  }

  /**
   * Create alerts SSE client
   */
  alerts(config?: Partial<SSEConfig>): SSEClient {
    return createSSEClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/alerts`,
      ...config,
    });
  }

  /**
   * Create tickets SSE client
   */
  tickets(config?: Partial<SSEConfig>): SSEClient {
    return createSSEClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/tickets`,
      ...config,
    });
  }

  /**
   * Create subscribers SSE client
   */
  subscribers(config?: Partial<SSEConfig>): SSEClient {
    return createSSEClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/subscribers`,
      ...config,
    });
  }

  /**
   * Create RADIUS sessions SSE client
   */
  radiusSessions(config?: Partial<SSEConfig>): SSEClient {
    return createSSEClient({
      endpoint: `${this.baseUrl}/api/isp/v1/admin/realtime/radius-sessions`,
      ...config,
    });
  }
}
