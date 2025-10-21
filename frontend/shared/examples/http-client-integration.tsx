/**
 * Example: HTTP Client Integration
 *
 * This file demonstrates how to integrate the @dotmac/http-client package
 * into management and ISP portal applications.
 */

import { useEffect, useState } from "react";
import {
  HttpClient,
  createTenantClient,
  createAuthClient,
  type ApiResponse,
} from "@dotmac/http-client";

// 1. Basic HTTP Client Setup (Global Instance)
export const apiClient = createAuthClient(
  {
    tokenSource: "cookie",
    tokenKey: "access_token",
    refreshTokenKey: "refresh_token",
  },
  {
    baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
    timeout: 30000,
    retries: 3,
  },
).setTenantFromHostname();

// 2. React Hook for API Calls with Error Handling
export function useApiCall<T>(
  endpoint: string,
  options?: {
    immediate?: boolean;
    skipAuth?: boolean;
    skipTenantId?: boolean;
  },
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options?.immediate !== false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (config?: any) => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<T> = await apiClient.get(endpoint, {
        ...config,
        skipAuth: options?.skipAuth,
        skipTenantId: options?.skipTenantId,
      });

      setData(response.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.immediate !== false) {
      execute();
    }
  }, [endpoint]);

  return { data, loading, error, refetch: execute };
}

// 3. Example: Customer Management Component
interface Customer {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
}

export function CustomerManagement() {
  const { data: customers, loading, error, refetch } = useApiCall<Customer[]>("/customers");

  const createCustomer = async (customerData: Omit<Customer, "id">) => {
    try {
      const response = await apiClient.post<Customer>("/customers", customerData);

      // Refresh the list after creation
      refetch();

      return response.data;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const response = await apiClient.patch<Customer>(`/customers/${id}`, updates);

      // Refresh the list after update
      refetch();

      return response.data;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await apiClient.delete(`/customers/${id}`);

      // Refresh the list after deletion
      refetch();
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  return {
    customers,
    loading,
    error,
    actions: {
      create: createCustomer,
      update: updateCustomer,
      delete: deleteCustomer,
      refresh: refetch,
    },
  };
}

// 4. Example: Multi-Tenant API Configuration
export class TenantAwareApiService {
  private client: HttpClient;

  constructor(tenantId?: string) {
    if (tenantId) {
      // Specific tenant client
      this.client = createTenantClient(tenantId, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
      }).enableAuth();
    } else {
      // Auto-detect tenant from hostname
      this.client = HttpClient.createFromHostname({
        baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
      }).enableAuth();
    }
  }

  async getUsers() {
    return this.client.get("/users");
  }

  async getBilling() {
    return this.client.get("/billing");
  }

  async getNetworkStatus() {
    return this.client.get("/network/status");
  }

  // Switch tenant context
  switchTenant(tenantId: string) {
    this.client.setTenantId(tenantId);
  }

  getCurrentTenant() {
    return this.client.getCurrentTenantId();
  }
}

// 5. Example: Error Handling with Retry Logic
export async function robustApiCall<T>(
  endpoint: string,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
  },
): Promise<T> {
  const client = createAuthClient();

  try {
    const response = await client.get<T>(endpoint, {
      skipRetry: false, // Enable retry logic
    });

    return response.data;
  } catch (error: any) {
    // Custom error handling based on error type
    if (error.status === 401) {
      // Redirect to login
      window.location.href = "/login";
      throw error;
    }

    if (error.status === 403) {
      // Show access denied message
      throw new Error("Access denied. Please contact your administrator.");
    }

    if (error.status >= 500) {
      // Server error - show user-friendly message
      throw new Error("Server temporarily unavailable. Please try again later.");
    }

    // Re-throw other errors as-is
    throw error;
  }
}

// 6. Example: File Upload with Progress
export async function uploadFile(
  file: File,
  endpoint: string,
  onProgress?: (progress: number) => void,
) {
  const formData = new FormData();
  formData.append("file", file);

  const client = createAuthClient();

  try {
    const response = await client.post(endpoint, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(percentCompleted);
        }
      },
    });

    return response.data;
  } catch (error: any) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// 7. Export configured clients for different use cases
export const clients = {
  // Default client with auto-tenant detection
  default: apiClient,

  // Management platform client (specific tenant)
  management: createTenantClient("management", {
    baseURL: process.env.NEXT_PUBLIC_MANAGEMENT_API_URL,
  }).enableAuth(),

  // Public API client (no auth)
  public: HttpClient.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
  }),

  // Admin client with elevated permissions
  admin: createAuthClient(
    {
      tokenKey: "admin_token",
    },
    {
      baseURL: process.env.NEXT_PUBLIC_ADMIN_API_URL,
    },
  ),
};
