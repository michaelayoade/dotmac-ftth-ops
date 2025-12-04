/**
 * TypeScript type definitions for Real-Time Events
 *
 * These types match the backend Pydantic schemas and event structures
 * from /src/dotmac/platform/realtime/schemas.py
 */

// ============================================================================
// Event Type Enums
// ============================================================================

export enum EventType {
  // ONU Events
  ONU_ONLINE = "onu.online",
  ONU_OFFLINE = "onu.offline",
  ONU_SIGNAL_DEGRADED = "onu.signal_degraded",
  ONU_PROVISIONED = "onu.provisioned",
  ONU_DEPROVISIONED = "onu.deprovisioned",

  // RADIUS Session Events
  SESSION_STARTED = "session.started",
  SESSION_UPDATED = "session.updated",
  SESSION_STOPPED = "session.stopped",

  // Job Progress Events
  JOB_CREATED = "job.created",
  JOB_PROGRESS = "job.progress",
  JOB_COMPLETED = "job.completed",
  JOB_FAILED = "job.failed",
  JOB_CANCELLED = "job.cancelled",

  // Ticket Events
  TICKET_CREATED = "ticket.created",
  TICKET_UPDATED = "ticket.updated",
  TICKET_ASSIGNED = "ticket.assigned",
  TICKET_RESOLVED = "ticket.resolved",

  // Alert Events
  ALERT_RAISED = "alert.raised",
  ALERT_CLEARED = "alert.cleared",

  // Subscriber Events
  SUBSCRIBER_CREATED = "subscriber.created",
  SUBSCRIBER_ACTIVATED = "subscriber.activated",
  SUBSCRIBER_SUSPENDED = "subscriber.suspended",
  SUBSCRIBER_TERMINATED = "subscriber.terminated",
}

export enum ConnectionStatus {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

// ============================================================================
// Base Event Interfaces
// ============================================================================

export interface BaseEvent<T = any> {
  event_type: EventType | string;
  tenant_id: string;
  timestamp: string;
  data?: T;
}

// ============================================================================
// ONU Events
// ============================================================================

export interface ONUStatusEvent extends BaseEvent {
  event_type:
    | EventType.ONU_ONLINE
    | EventType.ONU_OFFLINE
    | EventType.ONU_SIGNAL_DEGRADED
    | EventType.ONU_PROVISIONED
    | EventType.ONU_DEPROVISIONED;
  onu_serial: string;
  subscriber_id?: string;
  status: "online" | "offline" | "degraded" | "provisioned" | "deprovisioned";
  signal_dbm?: number;
  previous_status?: string;
  olt_id?: string;
  pon_port?: number;
}

// ============================================================================
// RADIUS Session Events
// ============================================================================

export interface RADIUSSessionEvent extends BaseEvent {
  event_type: EventType.SESSION_STARTED | EventType.SESSION_UPDATED | EventType.SESSION_STOPPED;
  username: string;
  session_id: string;
  nas_ip_address: string;
  framed_ip_address?: string;
  bytes_in: number;
  bytes_out: number;
  session_time: number;
  terminate_cause?: string;
}

// ============================================================================
// Job Events
// ============================================================================

export interface JobProgressEvent extends BaseEvent {
  event_type:
    | EventType.JOB_CREATED
    | EventType.JOB_PROGRESS
    | EventType.JOB_COMPLETED
    | EventType.JOB_FAILED
    | EventType.JOB_CANCELLED;
  job_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress_percent: number;
  items_total?: number;
  items_processed?: number;
  items_succeeded?: number;
  items_failed?: number;
  current_item?: string;
  error_message?: string | null;
}

// ============================================================================
// Ticket Events
// ============================================================================

export interface TicketEvent extends BaseEvent {
  event_type:
    | EventType.TICKET_CREATED
    | EventType.TICKET_UPDATED
    | EventType.TICKET_ASSIGNED
    | EventType.TICKET_RESOLVED;
  ticket_id: string;
  ticket_number: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  assigned_to?: string;
  subscriber_id?: string;
  customer_id?: string;
}

// ============================================================================
// Alert Events
// ============================================================================

export interface AlertEvent extends BaseEvent {
  event_type: EventType.ALERT_RAISED | EventType.ALERT_CLEARED;
  alert_id: string;
  alert_type: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  message: string;
  details?: Record<string, any>;
}

// ============================================================================
// Subscriber Events
// ============================================================================

export interface SubscriberEvent extends BaseEvent {
  event_type:
    | EventType.SUBSCRIBER_CREATED
    | EventType.SUBSCRIBER_ACTIVATED
    | EventType.SUBSCRIBER_SUSPENDED
    | EventType.SUBSCRIBER_TERMINATED;
  subscriber_id: string;
  account_number: string;
  full_name?: string;
  status: "active" | "inactive" | "suspended" | "terminated";
  plan?: string;
  onu_serial?: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export enum WebSocketMessageType {
  PING = "ping",
  PONG = "pong",
  SUBSCRIBED = "subscribed",
  ERROR = "error",
  CANCEL_JOB = "cancel_job",
  PAUSE_JOB = "pause_job",
  RESUME_JOB = "resume_job",
  CANCEL_CAMPAIGN = "cancel_campaign",
  PAUSE_CAMPAIGN = "pause_campaign",
  RESUME_CAMPAIGN = "resume_campaign",
}

export interface WebSocketClientMessage {
  type: WebSocketMessageType;
  timestamp?: string;
}

export interface WebSocketServerMessage {
  type: WebSocketMessageType | string;
  channel?: string;
  message?: string;
  tenant_id?: string;
  job_id?: string;
  campaign_id?: string;
  timestamp?: string;
}

// ============================================================================
// SSE Configuration
// ============================================================================

/**
 * SSE connection configuration.
 * Authentication is handled via httpOnly cookies (withCredentials: true).
 */
export interface SSEConfig {
  endpoint: string;
  onEvent?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

// ============================================================================
// WebSocket Configuration
// ============================================================================

/**
 * WebSocket connection configuration.
 * Authentication is handled via httpOnly cookies sent with the HTTP upgrade handshake.
 */
export interface WebSocketConfig {
  endpoint: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onMessage?: (message: any) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
}

// ============================================================================
// Realtime Hook Return Types
// ============================================================================

export interface SSEConnection {
  status: ConnectionStatus;
  error: string | null;
  subscribe: <T extends BaseEvent>(
    eventType: EventType | string,
    handler: (event: T) => void,
  ) => () => void;
  close: () => void;
  reconnect: () => void;
}

export interface WebSocketConnection {
  status: ConnectionStatus;
  error: string | null;
  isConnected: boolean;
  send: (message: WebSocketClientMessage) => void;
  subscribe: <T extends BaseEvent>(
    eventType: EventType | string,
    handler: (event: T) => void,
  ) => () => void;
  close: () => void;
  reconnect: () => void;
}

// ============================================================================
// Event Handler Types
// ============================================================================

export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void;

export interface EventSubscription {
  eventType: EventType | string;
  handler: EventHandler;
  unsubscribe: () => void;
}

// ============================================================================
// Realtime Channel Types
// ============================================================================

export enum RealtimeChannel {
  ONU_STATUS = "/api/v1/realtime/onu-status",
  ALERTS = "/api/v1/realtime/alerts",
  TICKETS = "/api/v1/realtime/tickets",
  SUBSCRIBERS = "/api/v1/realtime/subscribers",
  RADIUS_SESSIONS = "/api/v1/realtime/radius-sessions",
  WS_SESSIONS = "/api/v1/realtime/ws/sessions",
  WS_JOB = "/api/v1/realtime/ws/jobs",
  WS_CAMPAIGN = "/api/v1/realtime/ws/campaigns",
}

// ============================================================================
// Connection Quality Metrics
// ============================================================================

export interface ConnectionMetrics {
  latency: number; // milliseconds
  messagesReceived: number;
  messagesSent: number;
  reconnectCount: number;
  lastMessageAt: string | null;
  connectedAt: string | null;
}

// ============================================================================
// Realtime Context Type
// ============================================================================

export interface RealtimeContextValue {
  // Connection Status
  sseStatus: ConnectionStatus;
  wsStatus: ConnectionStatus;

  // SSE Subscriptions
  subscribeToONUStatus: (handler: EventHandler<ONUStatusEvent>) => () => void;
  subscribeToAlerts: (handler: EventHandler<AlertEvent>) => () => void;
  subscribeToTickets: (handler: EventHandler<TicketEvent>) => () => void;
  subscribeToSubscribers: (handler: EventHandler<SubscriberEvent>) => () => void;
  subscribeToRadiusSessions: (handler: EventHandler<RADIUSSessionEvent>) => () => void;

  // WebSocket Connections
  connectToSessionsWS: () => WebSocketConnection;
  connectToJobWS: (jobId: string) => WebSocketConnection;
  connectToCampaignWS: (campaignId: string) => WebSocketConnection;

  // Connection Control
  reconnectAll: () => void;
  disconnectAll: () => void;

  // Metrics
  metrics: ConnectionMetrics;
}

// ============================================================================
// Utility Types
// ============================================================================

export type RealtimeEventMap = {
  [EventType.ONU_ONLINE]: ONUStatusEvent;
  [EventType.ONU_OFFLINE]: ONUStatusEvent;
  [EventType.ONU_SIGNAL_DEGRADED]: ONUStatusEvent;
  [EventType.ONU_PROVISIONED]: ONUStatusEvent;
  [EventType.ONU_DEPROVISIONED]: ONUStatusEvent;
  [EventType.SESSION_STARTED]: RADIUSSessionEvent;
  [EventType.SESSION_UPDATED]: RADIUSSessionEvent;
  [EventType.SESSION_STOPPED]: RADIUSSessionEvent;
  [EventType.JOB_CREATED]: JobProgressEvent;
  [EventType.JOB_PROGRESS]: JobProgressEvent;
  [EventType.JOB_COMPLETED]: JobProgressEvent;
  [EventType.JOB_FAILED]: JobProgressEvent;
  [EventType.JOB_CANCELLED]: JobProgressEvent;
  [EventType.TICKET_CREATED]: TicketEvent;
  [EventType.TICKET_UPDATED]: TicketEvent;
  [EventType.TICKET_ASSIGNED]: TicketEvent;
  [EventType.TICKET_RESOLVED]: TicketEvent;
  [EventType.ALERT_RAISED]: AlertEvent;
  [EventType.ALERT_CLEARED]: AlertEvent;
  [EventType.SUBSCRIBER_CREATED]: SubscriberEvent;
  [EventType.SUBSCRIBER_ACTIVATED]: SubscriberEvent;
  [EventType.SUBSCRIBER_SUSPENDED]: SubscriberEvent;
  [EventType.SUBSCRIBER_TERMINATED]: SubscriberEvent;
};

// Helper type for typed event handlers
export type TypedEventHandler<T extends EventType> = EventHandler<RealtimeEventMap[T]>;
