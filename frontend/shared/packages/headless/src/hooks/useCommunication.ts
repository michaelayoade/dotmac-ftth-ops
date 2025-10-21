import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "./useNotifications";

export interface CommunicationChannel {
  id: string;
  name: string;
  type: "email" | "sms" | "push" | "websocket" | "webhook";
  status: "active" | "inactive" | "error";
  config: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables: string[];
  priority: "low" | "medium" | "high" | "critical";
  category: string;
}

export interface CommunicationMessage {
  id: string;
  templateId?: string;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "sent" | "delivered" | "failed" | "bounced";
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

export interface CommunicationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  failureRate: number;
  channelBreakdown: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      rate: number;
    }
  >;
  recentActivity: CommunicationMessage[];
}

interface UseCommunicationOptions {
  apiEndpoint?: string;
  websocketEndpoint?: string;
  apiKey?: string;
  tenantId?: string;
  pollInterval?: number;
  enableRealtime?: boolean;
  maxRetries?: number;
}

interface CommunicationState {
  channels: CommunicationChannel[];
  templates: CommunicationTemplate[];
  messages: CommunicationMessage[];
  stats: CommunicationStats | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

const initialStats: CommunicationStats = {
  totalSent: 0,
  totalDelivered: 0,
  totalFailed: 0,
  deliveryRate: 0,
  failureRate: 0,
  channelBreakdown: {},
  recentActivity: [],
};

const initialState: CommunicationState = {
  channels: [],
  templates: [],
  messages: [],
  stats: initialStats,
  isLoading: false,
  error: null,
  isConnected: false,
};

export function useCommunication(options: UseCommunicationOptions = {}) {
  const {
    apiEndpoint = "/api/communication",
    websocketEndpoint,
    apiKey,
    tenantId,
    pollInterval = 30000,
    enableRealtime = true,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<CommunicationState>(initialState);
  const websocketRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const { addNotification } = useNotifications();

  // API Helper
  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
      }

      const response = await fetch(`${apiEndpoint}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    [apiEndpoint, apiKey, tenantId],
  );

  // WebSocket Connection
  const connectWebSocket = useCallback(() => {
    if (!websocketEndpoint || !enableRealtime) return;

    try {
      if (websocketRef.current?.readyState === WebSocket.OPEN) return;

      const wsUrl = new URL(websocketEndpoint);
      if (apiKey) wsUrl.searchParams.set("apiKey", apiKey);
      if (tenantId) wsUrl.searchParams.set("tenantId", tenantId);

      const ws = new WebSocket(wsUrl.toString());
      websocketRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        retryCountRef.current = 0;

        addNotification({
          type: "system",
          priority: "low",
          title: "Communication System",
          message: "Real-time communication connected",
          channel: ["browser"],
          persistent: false,
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "message_status_update":
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === data.messageId
                    ? {
                        ...msg,
                        status: data.status,
                        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
                      }
                    : msg,
                ),
              }));
              break;

            case "new_message":
              setState((prev) => ({
                ...prev,
                messages: [data.message, ...prev.messages],
              }));
              break;

            case "channel_status_update":
              setState((prev) => ({
                ...prev,
                channels: prev.channels.map((channel) =>
                  channel.id === data.channelId ? { ...channel, status: data.status } : channel,
                ),
              }));
              break;

            case "stats_update":
              setState((prev) => ({
                ...prev,
                stats: data.stats,
              }));
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));

        // Reconnect with exponential backoff
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          setTimeout(() => {
            retryCountRef.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: "WebSocket connection failed",
        }));
      };
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
    }
  }, [websocketEndpoint, enableRealtime, apiKey, tenantId, maxRetries, addNotification]);

  // Load Channels
  const loadChannels = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await apiCall("/channels");
      setState((prev) => ({
        ...prev,
        channels: data.channels || [],
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load channels",
        isLoading: false,
      }));
    }
  }, [apiCall]);

  // Load Templates
  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiCall("/templates");
      setState((prev) => ({
        ...prev,
        templates: data.templates || [],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load templates",
      }));
    }
  }, [apiCall]);

  // Load Messages
  const loadMessages = useCallback(
    async (
      filters: {
        limit?: number;
        offset?: number;
        status?: string;
        channel?: string;
        priority?: string;
        dateFrom?: Date;
        dateTo?: Date;
      } = {},
    ) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value instanceof Date ? value.toISOString() : String(value));
          }
        });

        const data = await apiCall(`/messages?${params.toString()}`);
        setState((prev) => ({
          ...prev,
          messages: data.messages || [],
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load messages",
          isLoading: false,
        }));
      }
    },
    [apiCall],
  );

  // Load Statistics
  const loadStats = useCallback(
    async (timeRange: "24h" | "7d" | "30d" | "90d" = "24h") => {
      try {
        const data = await apiCall(`/stats?range=${timeRange}`);
        setState((prev) => ({
          ...prev,
          stats: data.stats || initialStats,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load statistics",
        }));
      }
    },
    [apiCall],
  );

  // Send Message
  const sendMessage = useCallback(
    async (messageData: {
      templateId?: string;
      channel: string;
      recipient: string;
      subject?: string;
      body?: string;
      variables?: Record<string, any>;
      priority?: "low" | "medium" | "high" | "critical";
      scheduledAt?: Date;
      metadata?: Record<string, any>;
    }) => {
      try {
        const data = await apiCall("/messages", {
          method: "POST",
          body: JSON.stringify({
            ...messageData,
            scheduledAt: messageData.scheduledAt?.toISOString(),
          }),
        });

        const newMessage = data.message;
        setState((prev) => ({
          ...prev,
          messages: [newMessage, ...prev.messages],
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Message Sent",
          message: `Message sent to ${messageData.recipient} via ${messageData.channel}`,
          channel: ["browser"],
          persistent: false,
        });

        return newMessage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send message";

        addNotification({
          type: "error",
          priority: "high",
          title: "Message Failed",
          message: `Failed to send message: ${errorMessage}`,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Bulk Send Messages
  const sendBulkMessages = useCallback(
    async (
      messages: Array<{
        templateId?: string;
        channel: string;
        recipient: string;
        subject?: string;
        body?: string;
        variables?: Record<string, any>;
        priority?: "low" | "medium" | "high" | "critical";
        scheduledAt?: Date;
        metadata?: Record<string, any>;
      }>,
    ) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const data = await apiCall("/messages/bulk", {
          method: "POST",
          body: JSON.stringify({
            messages: messages.map((msg) => ({
              ...msg,
              scheduledAt: msg.scheduledAt?.toISOString(),
            })),
          }),
        });

        const newMessages = data.messages || [];
        setState((prev) => ({
          ...prev,
          messages: [...newMessages, ...prev.messages],
          isLoading: false,
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Bulk Messages Sent",
          message: `${newMessages.length} messages queued for delivery`,
          channel: ["browser"],
          persistent: false,
        });

        return newMessages;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));

        const errorMessage =
          error instanceof Error ? error.message : "Failed to send bulk messages";

        addNotification({
          type: "error",
          priority: "high",
          title: "Bulk Send Failed",
          message: `Failed to send bulk messages: ${errorMessage}`,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Create Template
  const createTemplate = useCallback(
    async (templateData: Omit<CommunicationTemplate, "id">) => {
      try {
        const data = await apiCall("/templates", {
          method: "POST",
          body: JSON.stringify(templateData),
        });

        const newTemplate = data.template;
        setState((prev) => ({
          ...prev,
          templates: [newTemplate, ...prev.templates],
        }));

        return newTemplate;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create template";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [apiCall],
  );

  // Update Template
  const updateTemplate = useCallback(
    async (id: string, templateData: Partial<CommunicationTemplate>) => {
      try {
        const data = await apiCall(`/templates/${id}`, {
          method: "PUT",
          body: JSON.stringify(templateData),
        });

        const updatedTemplate = data.template;
        setState((prev) => ({
          ...prev,
          templates: prev.templates.map((template) =>
            template.id === id ? updatedTemplate : template,
          ),
        }));

        return updatedTemplate;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update template";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [apiCall],
  );

  // Delete Template
  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        await apiCall(`/templates/${id}`, {
          method: "DELETE",
        });

        setState((prev) => ({
          ...prev,
          templates: prev.templates.filter((template) => template.id !== id),
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete template";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [apiCall],
  );

  // Test Channel
  const testChannel = useCallback(
    async (channelId: string, testData: Record<string, any>) => {
      try {
        const data = await apiCall(`/channels/${channelId}/test`, {
          method: "POST",
          body: JSON.stringify(testData),
        });

        addNotification({
          type: data.success ? "success" : "error",
          priority: "medium",
          title: "Channel Test",
          message:
            data.message || `Channel ${channelId} test ${data.success ? "passed" : "failed"}`,
          channel: ["browser"],
          persistent: false,
        });

        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Channel test failed";

        addNotification({
          type: "error",
          priority: "high",
          title: "Channel Test Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Cancel Message
  const cancelMessage = useCallback(
    async (messageId: string) => {
      try {
        await apiCall(`/messages/${messageId}/cancel`, {
          method: "POST",
        });

        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: "failed", failureReason: "Cancelled by user" }
              : msg,
          ),
        }));

        addNotification({
          type: "info",
          priority: "low",
          title: "Message Cancelled",
          message: "Message has been cancelled successfully",
          channel: ["browser"],
          persistent: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to cancel message";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Cancel Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Retry Failed Message
  const retryMessage = useCallback(
    async (messageId: string) => {
      try {
        const data = await apiCall(`/messages/${messageId}/retry`, {
          method: "POST",
        });

        const retriedMessage = data.message;
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) => (msg.id === messageId ? retriedMessage : msg)),
        }));

        addNotification({
          type: "info",
          priority: "low",
          title: "Message Retried",
          message: "Message has been queued for retry",
          channel: ["browser"],
          persistent: false,
        });

        return retriedMessage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to retry message";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Retry Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Initialize
  useEffect(() => {
    loadChannels();
    loadTemplates();
    loadMessages({ limit: 50 });
    loadStats();

    if (enableRealtime) {
      connectWebSocket();
    }

    // Set up polling for non-realtime updates
    if (!enableRealtime && pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        loadStats();
        loadMessages({ limit: 10 }); // Get recent messages
      }, pollInterval);
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [
    loadChannels,
    loadTemplates,
    loadMessages,
    loadStats,
    connectWebSocket,
    enableRealtime,
    pollInterval,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,

    // Actions
    sendMessage,
    sendBulkMessages,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    testChannel,
    cancelMessage,
    retryMessage,

    // Data loaders
    loadChannels,
    loadTemplates,
    loadMessages,
    loadStats,

    // Connection management
    connect: connectWebSocket,
    disconnect: useCallback(() => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    }, []),

    // Utils
    clearError: useCallback(() => {
      setState((prev) => ({ ...prev, error: null }));
    }, []),

    // Computed values
    activeChannels: state.channels.filter((ch) => ch.status === "active"),
    failedMessages: state.messages.filter((msg) => msg.status === "failed"),
    pendingMessages: state.messages.filter((msg) => msg.status === "pending"),
    recentMessages: state.messages.slice(0, 10),
  };
}

export default useCommunication;
