import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import {
  Customer,
  CustomerMetrics,
  CustomerSearchParams,
  CustomerCreateInput,
  CustomerUpdateInput,
  ApiResponse,
  PaginatedResponse,
} from "@/types";

export interface CustomerActivity {
  id: string;
  customer_id: string;
  activity_type: string;
  title: string;
  description: string | undefined;
  metadata: Record<string, unknown>;
  performed_by: string | undefined;
  created_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  subject: string;
  content: string;
  is_internal: boolean;
  created_by_id: string;
  created_at: string;
}

// Helper function to handle API errors
const handleApiError = (error: unknown) => {
  if (error && typeof error === "object" && "response" in error) {
    const err = error as { response?: { status: number } };
    if (err.response?.status === 401) {
      // Token expired or invalid - redirect to login
      window.location.href = "/login";
      return;
    }
  }
  throw error;
};

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    page_size: 50,
    has_next: false,
    has_prev: false,
  });

  // Fetch customer metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiClient.get("/customers/metrics/overview");
      const data = (response["data"] || {}) as Record<string, any>;
      logger.debug("Customer metrics fetched", {
        metricKeys: Object.keys(data ?? {}),
        topSegmentCount: Array.isArray(data["top_segments"]) ? data["top_segments"].length : 0,
      });
      setMetrics(data as CustomerMetrics);
    } catch (err) {
      logger.error("Failed to fetch metrics", err instanceof Error ? err : new Error(String(err)));
      setError("Failed to fetch customer metrics");
      handleApiError(err);
    }
  }, []);

  // Search customers
  const searchCustomers = useCallback(async (params: CustomerSearchParams = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post("/customers/search", {
        ...params,
        page: params["page"] || 1,
        page_size: (params as any).page_size || params["pageSize"] || 50,
      });

      const data = response["data"] as any;
      setCustomers(data["customers"] || []);
      setPagination({
        total: data["total"] || 0,
        page: data["page"] || 1,
        page_size: data["page_size"] || 50,
        has_next: data["has_next"] || false,
        has_prev: data["has_prev"] || false,
      });
    } catch (err) {
      logger.error(
        "Failed to search customers",
        err instanceof Error ? err : new Error(String(err)),
      );
      setError("Failed to search customers");
      setCustomers([]);
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create customer
  const createCustomer = useCallback(
    async (customerData: CustomerCreateInput): Promise<Customer> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post("/customers/", customerData);
        return response["data"] as Customer;
      } catch (err) {
        logger.error(
          "Failed to create customer",
          err instanceof Error ? err : new Error(String(err)),
        );
        setError("Failed to create customer");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Update customer
  const updateCustomer = useCallback(
    async (customerId: string, customerData: CustomerUpdateInput): Promise<Customer> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.patch(`/customers/${customerId}`, customerData);
        const updatedCustomer = response["data"] as Customer;

        // Update the customer in the local state
        setCustomers((prev) =>
          prev.map((customer) => (customer.id === customerId ? updatedCustomer : customer)),
        );

        return updatedCustomer;
      } catch (err) {
        logger.error(
          "Failed to update customer",
          err instanceof Error ? err : new Error(String(err)),
        );
        setError("Failed to update customer");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Delete customer
  const deleteCustomer = useCallback(async (customerId: string, hardDelete = false) => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.delete(`/customers/${customerId}`, {
        params: { hard_delete: hardDelete },
      });

      // Remove from local state
      setCustomers((prev) => prev.filter((customer) => customer["id"] !== customerId));
      return true;
    } catch (err) {
      logger.error(
        "Failed to delete customer",
        err instanceof Error ? err : new Error(String(err)),
      );
      setError("Failed to delete customer");
      handleApiError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get customer by ID
  const getCustomer = useCallback(
    async (customerId: string, includeActivities = false, includeNotes = false) => {
      setLoading(true);
      setError(null);

      try {
        // Build query string manually to ensure compatibility
        const queryParams = new URLSearchParams();
        if (includeActivities) queryParams.append("include_activities", "true");
        if (includeNotes) queryParams.append("include_notes", "true");

        const queryString = queryParams.toString();
        const url = `/customers/${customerId}${queryString ? `?${queryString}` : ""}`;

        const response = await apiClient.get(url);
        return response["data"];
      } catch (err) {
        logger.error("Failed to get customer", err instanceof Error ? err : new Error(String(err)));
        setError("Failed to get customer");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Refresh current data
  const refreshCustomers = useCallback(() => {
    searchCustomers();
    fetchMetrics();
  }, [searchCustomers, fetchMetrics]);

  // Load initial data
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    customers,
    loading,
    error,
    metrics,
    pagination,
    searchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomer,
    refreshCustomers,
  };
};

export const useCustomerActivities = (customerId: string) => {
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(
    async (limit = 50, offset = 0) => {
      setLoading(true);
      setError(null);

      try {
        // Build query string manually to ensure compatibility
        const queryParams = new URLSearchParams();
        queryParams.append("limit", limit.toString());
        queryParams.append("offset", offset.toString());

        const queryString = queryParams.toString();
        const url = `/customers/${customerId}/activities?${queryString}`;

        const response = await apiClient.get(url);
        setActivities((response["data"] as CustomerActivity[]) || []);
      } catch (err) {
        logger.error(
          "Failed to fetch activities",
          err instanceof Error ? err : new Error(String(err)),
        );
        setError("Failed to fetch activities");
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  const addActivity = useCallback(
    async (activityData: Omit<CustomerActivity, "id" | "customer_id" | "created_at">) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(`/customers/${customerId}/activities`, activityData);
        const newActivity = response["data"] as CustomerActivity;
        setActivities((prev) => [newActivity, ...prev]);
        return newActivity;
      } catch (err) {
        logger.error("Failed to add activity", err instanceof Error ? err : new Error(String(err)));
        setError("Failed to add activity");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    if (customerId) {
      fetchActivities();
    }
  }, [customerId, fetchActivities]);

  return {
    activities,
    loading,
    error,
    fetchActivities,
    addActivity,
  };
};

export const useCustomerNotes = (customerId: string) => {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(
    async (includeInternal = true, limit = 50, offset = 0) => {
      setLoading(true);
      setError(null);

      try {
        // Build query string manually to ensure compatibility
        const queryParams = new URLSearchParams();
        queryParams.append("include_internal", includeInternal.toString());
        queryParams.append("limit", limit.toString());
        queryParams.append("offset", offset.toString());

        const queryString = queryParams.toString();
        const url = `/customers/${customerId}/notes?${queryString}`;

        const response = await apiClient.get(url);
        setNotes((response["data"] as CustomerNote[]) || []);
      } catch (err) {
        logger.error("Failed to fetch notes", err instanceof Error ? err : new Error(String(err)));
        setError("Failed to fetch notes");
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  const addNote = useCallback(
    async (noteData: Omit<CustomerNote, "id" | "customer_id" | "created_by_id" | "created_at">) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(`/customers/${customerId}/notes`, noteData);
        const newNote = response["data"] as CustomerNote;
        setNotes((prev) => [newNote, ...prev]);
        return newNote;
      } catch (err) {
        logger.error("Failed to add note", err instanceof Error ? err : new Error(String(err)));
        setError("Failed to add note");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    if (customerId) {
      fetchNotes();
    }
  }, [customerId, fetchNotes]);

  return {
    notes,
    loading,
    error,
    fetchNotes,
    addNote,
  };
};

// Standalone hook for getting single customer without duplicating state
export const useCustomer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCustomer = useCallback(
    async (customerId: string, includeActivities = false, includeNotes = false) => {
      setLoading(true);
      setError(null);

      try {
        // Build query string manually to ensure compatibility
        const queryParams = new URLSearchParams();
        if (includeActivities) queryParams.append("include_activities", "true");
        if (includeNotes) queryParams.append("include_notes", "true");

        const queryString = queryParams.toString();
        const url = `/customers/${customerId}${queryString ? `?${queryString}` : ""}`;

        const response = await apiClient.get(url);
        return response["data"];
      } catch (err) {
        logger.error("Failed to get customer", err instanceof Error ? err : new Error(String(err)));
        setError("Failed to get customer");
        handleApiError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    getCustomer,
    loading,
    error,
  };
};
