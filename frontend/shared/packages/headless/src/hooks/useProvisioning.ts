import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "./useNotifications";

export interface ServiceTemplate {
  id: string;
  name: string;
  category: "internet" | "phone" | "tv" | "bundle";
  speed?: string;
  features: string[];
  pricing: {
    setup: number;
    monthly: number;
    annual?: number;
  };
  requirements: {
    equipment: string[];
    technician: boolean;
    coverage: string[];
  };
  sla: {
    provisioningTime: number; // hours
    installationWindow: string;
    supportLevel: string;
  };
  metadata?: Record<string, any>;
}

export interface ProvisioningRequest {
  id: string;
  customerId: string;
  serviceTemplateId: string;
  status:
    | "pending"
    | "approved"
    | "provisioning"
    | "installing"
    | "active"
    | "failed"
    | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  requestedAt: Date;
  scheduledAt?: Date;
  completedAt?: Date;
  assignedTechnician?: string;
  installationAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    coordinates?: { lat: number; lng: number };
  };
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    preferences?: {
      contactMethod: string;
      installationTime: string;
    };
  };
  equipment: EquipmentOrder[];
  tasks: ProvisioningTask[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface EquipmentOrder {
  id: string;
  name: string;
  type: "modem" | "router" | "cable" | "dish" | "stb" | "other";
  quantity: number;
  serialNumbers?: string[];
  status: "ordered" | "shipped" | "delivered" | "installed";
  trackingNumber?: string;
  vendor?: string;
  model?: string;
}

export interface ProvisioningTask {
  id: string;
  name: string;
  type: "automated" | "manual" | "technician";
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  assignedTo?: string;
  estimatedDuration: number; // minutes
  dependencies?: string[];
  instructions?: string;
  completedAt?: Date;
  result?: any;
  notes?: string;
}

export interface ProvisioningWorkflow {
  id: string;
  name: string;
  serviceCategory: string;
  tasks: Omit<ProvisioningTask, "id" | "status" | "completedAt" | "result">[];
  conditions: {
    requiresTechnician: boolean;
    requiresEquipment: boolean;
    businessHoursOnly: boolean;
    weatherDependent: boolean;
  };
  sla: {
    maxProvisioningTime: number; // hours
    escalationThreshold: number; // hours
  };
}

export interface ProvisioningStats {
  totalRequests: number;
  pendingRequests: number;
  activeInstallations: number;
  completedToday: number;
  averageProvisioningTime: number;
  successRate: number;
  slaCompliance: number;
  statusBreakdown: Record<string, number>;
  technicianWorkload: Record<string, number>;
  upcomingInstallations: ProvisioningRequest[];
}

interface UseProvisioningOptions {
  apiEndpoint?: string;
  websocketEndpoint?: string;
  apiKey?: string;
  tenantId?: string;
  resellerId?: string;
  pollInterval?: number;
  enableRealtime?: boolean;
  maxRetries?: number;
}

interface ProvisioningState {
  templates: ServiceTemplate[];
  requests: ProvisioningRequest[];
  workflows: ProvisioningWorkflow[];
  stats: ProvisioningStats | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  selectedRequest: ProvisioningRequest | null;
}

const initialStats: ProvisioningStats = {
  totalRequests: 0,
  pendingRequests: 0,
  activeInstallations: 0,
  completedToday: 0,
  averageProvisioningTime: 0,
  successRate: 0,
  slaCompliance: 0,
  statusBreakdown: {},
  technicianWorkload: {},
  upcomingInstallations: [],
};

const initialState: ProvisioningState = {
  templates: [],
  requests: [],
  workflows: [],
  stats: initialStats,
  isLoading: false,
  error: null,
  isConnected: false,
  selectedRequest: null,
};

export function useProvisioning(options: UseProvisioningOptions = {}) {
  const {
    apiEndpoint = "/api/provisioning",
    websocketEndpoint,
    apiKey,
    tenantId,
    resellerId,
    pollInterval = 30000,
    enableRealtime = true,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<ProvisioningState>(initialState);
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

      if (resellerId) {
        headers["X-Reseller-ID"] = resellerId;
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
    [apiEndpoint, apiKey, tenantId, resellerId],
  );

  // WebSocket Connection
  const connectWebSocket = useCallback(() => {
    if (!websocketEndpoint || !enableRealtime) return;

    try {
      if (websocketRef.current?.readyState === WebSocket.OPEN) return;

      const wsUrl = new URL(websocketEndpoint);
      if (apiKey) wsUrl.searchParams.set("apiKey", apiKey);
      if (tenantId) wsUrl.searchParams.set("tenantId", tenantId);
      if (resellerId) wsUrl.searchParams.set("resellerId", resellerId);

      const ws = new WebSocket(wsUrl.toString());
      websocketRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        retryCountRef.current = 0;

        addNotification({
          type: "system",
          priority: "low",
          title: "Provisioning System",
          message: "Real-time provisioning updates connected",
          channel: ["browser"],
          persistent: false,
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "request_status_update":
              setState((prev) => ({
                ...prev,
                requests: prev.requests.map((req) =>
                  req.id === data.requestId ? { ...req, ...data.updates } : req,
                ),
              }));

              // Show notification for important status changes
              if (["approved", "active", "failed"].includes(data.updates.status)) {
                addNotification({
                  type: data.updates.status === "failed" ? "error" : "success",
                  priority: data.updates.status === "failed" ? "high" : "medium",
                  title: "Service Request Update",
                  message: `Request ${data.requestId} is now ${data.updates.status}`,
                  channel: ["browser"],
                  persistent: false,
                });
              }
              break;

            case "new_request":
              setState((prev) => ({
                ...prev,
                requests: [data.request, ...prev.requests],
              }));

              addNotification({
                type: "info",
                priority: "medium",
                title: "New Service Request",
                message: `New ${data.request.serviceTemplateId} request received`,
                channel: ["browser"],
                persistent: false,
              });
              break;

            case "task_completed":
              setState((prev) => ({
                ...prev,
                requests: prev.requests.map((req) =>
                  req.id === data.requestId
                    ? {
                        ...req,
                        tasks: req.tasks.map((task) =>
                          task.id === data.taskId
                            ? {
                                ...task,
                                status: "completed",
                                completedAt: new Date(data.completedAt),
                              }
                            : task,
                        ),
                      }
                    : req,
                ),
              }));
              break;

            case "technician_assigned":
              setState((prev) => ({
                ...prev,
                requests: prev.requests.map((req) =>
                  req.id === data.requestId
                    ? { ...req, assignedTechnician: data.technicianId }
                    : req,
                ),
              }));

              addNotification({
                type: "info",
                priority: "low",
                title: "Technician Assigned",
                message: `Technician assigned to request ${data.requestId}`,
                channel: ["browser"],
                persistent: false,
              });
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
  }, [
    websocketEndpoint,
    enableRealtime,
    apiKey,
    tenantId,
    resellerId,
    maxRetries,
    addNotification,
  ]);

  // Load Service Templates
  const loadTemplates = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await apiCall("/templates");
      setState((prev) => ({
        ...prev,
        templates: data.templates || [],
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load templates",
        isLoading: false,
      }));
    }
  }, [apiCall]);

  // Load Provisioning Requests
  const loadRequests = useCallback(
    async (
      filters: {
        status?: string;
        priority?: string;
        customerId?: string;
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
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

        const data = await apiCall(`/requests?${params.toString()}`);
        setState((prev) => ({
          ...prev,
          requests: data.requests || [],
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load requests",
          isLoading: false,
        }));
      }
    },
    [apiCall],
  );

  // Load Statistics
  const loadStats = useCallback(
    async (timeRange: "24h" | "7d" | "30d" = "24h") => {
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

  // Create Service Request
  const createServiceRequest = useCallback(
    async (requestData: {
      customerId: string;
      serviceTemplateId: string;
      priority?: "low" | "medium" | "high" | "urgent";
      scheduledAt?: Date;
      installationAddress: ProvisioningRequest["installationAddress"];
      customerInfo: ProvisioningRequest["customerInfo"];
      notes?: string;
      metadata?: Record<string, any>;
    }) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const data = await apiCall("/requests", {
          method: "POST",
          body: JSON.stringify({
            ...requestData,
            scheduledAt: requestData.scheduledAt?.toISOString(),
          }),
        });

        const newRequest = data.request;
        setState((prev) => ({
          ...prev,
          requests: [newRequest, ...prev.requests],
          isLoading: false,
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Service Request Created",
          message: `Service request for ${requestData.customerInfo.name} has been submitted`,
          channel: ["browser"],
          persistent: false,
        });

        return newRequest;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));

        const errorMessage =
          error instanceof Error ? error.message : "Failed to create service request";

        addNotification({
          type: "error",
          priority: "high",
          title: "Request Creation Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Update Request Status
  const updateRequestStatus = useCallback(
    async (requestId: string, status: ProvisioningRequest["status"], notes?: string) => {
      try {
        const data = await apiCall(`/requests/${requestId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, notes }),
        });

        const updatedRequest = data.request;
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) => (req.id === requestId ? updatedRequest : req)),
        }));

        addNotification({
          type: "success",
          priority: "low",
          title: "Status Updated",
          message: `Request ${requestId} status updated to ${status}`,
          channel: ["browser"],
          persistent: false,
        });

        return updatedRequest;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update status";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Update Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Schedule Installation
  const scheduleInstallation = useCallback(
    async (requestId: string, scheduledAt: Date, technicianId?: string) => {
      try {
        const data = await apiCall(`/requests/${requestId}/schedule`, {
          method: "POST",
          body: JSON.stringify({
            scheduledAt: scheduledAt.toISOString(),
            technicianId,
          }),
        });

        const updatedRequest = data.request;
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) => (req.id === requestId ? updatedRequest : req)),
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Installation Scheduled",
          message: `Installation scheduled for ${scheduledAt.toLocaleDateString()}`,
          channel: ["browser"],
          persistent: false,
        });

        return updatedRequest;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to schedule installation";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Scheduling Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Execute Task
  const executeTask = useCallback(
    async (requestId: string, taskId: string, result?: any, notes?: string) => {
      try {
        const data = await apiCall(`/requests/${requestId}/tasks/${taskId}/execute`, {
          method: "POST",
          body: JSON.stringify({ result, notes }),
        });

        const updatedRequest = data.request;
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) => (req.id === requestId ? updatedRequest : req)),
        }));

        return updatedRequest;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to execute task";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Task Execution Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Cancel Request
  const cancelRequest = useCallback(
    async (requestId: string, reason: string) => {
      try {
        await apiCall(`/requests/${requestId}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });

        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) =>
            req.id === requestId ? { ...req, status: "cancelled", notes: reason } : req,
          ),
        }));

        addNotification({
          type: "info",
          priority: "low",
          title: "Request Cancelled",
          message: `Service request ${requestId} has been cancelled`,
          channel: ["browser"],
          persistent: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to cancel request";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Cancellation Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Bulk Operations
  const bulkUpdateStatus = useCallback(
    async (requestIds: string[], status: ProvisioningRequest["status"], notes?: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const data = await apiCall("/requests/bulk-update", {
          method: "POST",
          body: JSON.stringify({ requestIds, status, notes }),
        });

        const updatedRequests = data.requests || [];
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) =>
            requestIds.includes(req.id)
              ? updatedRequests.find((ur) => ur.id === req.id) || req
              : req,
          ),
          isLoading: false,
        }));

        addNotification({
          type: "success",
          priority: "medium",
          title: "Bulk Update Complete",
          message: `${requestIds.length} requests updated to ${status}`,
          channel: ["browser"],
          persistent: false,
        });

        return updatedRequests;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));

        const errorMessage =
          error instanceof Error ? error.message : "Failed to bulk update requests";

        addNotification({
          type: "error",
          priority: "high",
          title: "Bulk Update Failed",
          message: errorMessage,
          channel: ["browser"],
          persistent: false,
        });

        throw error;
      }
    },
    [apiCall, addNotification],
  );

  // Equipment Management
  const updateEquipmentStatus = useCallback(
    async (
      requestId: string,
      equipmentId: string,
      status: EquipmentOrder["status"],
      serialNumbers?: string[],
      trackingNumber?: string,
    ) => {
      try {
        const data = await apiCall(`/requests/${requestId}/equipment/${equipmentId}`, {
          method: "PUT",
          body: JSON.stringify({ status, serialNumbers, trackingNumber }),
        });

        const updatedRequest = data.request;
        setState((prev) => ({
          ...prev,
          requests: prev.requests.map((req) => (req.id === requestId ? updatedRequest : req)),
        }));

        return updatedRequest;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update equipment";

        addNotification({
          type: "error",
          priority: "medium",
          title: "Equipment Update Failed",
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
    loadTemplates();
    loadRequests({ limit: 50 });
    loadStats();

    if (enableRealtime) {
      connectWebSocket();
    }

    // Set up polling for non-realtime updates
    if (!enableRealtime && pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        loadStats();
        loadRequests({ limit: 10 }); // Get recent requests
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
  }, [loadTemplates, loadRequests, loadStats, connectWebSocket, enableRealtime, pollInterval]);

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
    createServiceRequest,
    updateRequestStatus,
    scheduleInstallation,
    executeTask,
    cancelRequest,
    bulkUpdateStatus,
    updateEquipmentStatus,

    // Data loaders
    loadTemplates,
    loadRequests,
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

    selectRequest: useCallback((request: ProvisioningRequest | null) => {
      setState((prev) => ({ ...prev, selectedRequest: request }));
    }, []),

    // Computed values
    pendingRequests: state.requests.filter((req) => req.status === "pending"),
    activeRequests: state.requests.filter((req) =>
      ["approved", "provisioning", "installing"].includes(req.status),
    ),
    urgentRequests: state.requests.filter((req) => req.priority === "urgent"),
    todayInstallations: state.requests.filter(
      (req) =>
        req.scheduledAt && new Date(req.scheduledAt).toDateString() === new Date().toDateString(),
    ),
  };
}

export default useProvisioning;
