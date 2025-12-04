/**
 * Partner Portal API Client with validation
 */

import { getApiClient } from "./client";
import type { ApiResponse } from "./types/api";
import {
  CustomerSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerQueryParamsSchema,
  CommissionQueryParamsSchema,
  TerritoryValidationSchema,
  DashboardDataSchema,
  sanitizeInput,
  sanitizeSearchTerm,
  type Customer,
  type CreateCustomer,
  type UpdateCustomer,
  type DashboardData,
} from "../validation/partner-schemas";
import type { CommissionRecord } from "../validation/partner-schemas";

// Use types from validation schemas instead of duplicating
export type { DashboardData as PartnerDashboardData } from "../validation/partner-schemas";
export type {
  Customer,
  CreateCustomer,
  UpdateCustomer,
  CommissionRecord as PartnerCommissionRecord,
} from "../validation/partner-schemas";

export class PartnerApiClient {
  private _client: ReturnType<typeof getApiClient> | null = null;

  private get client() {
    if (!this._client) {
      this._client = getApiClient();
    }
    return this._client;
  }

  async getDashboard(partnerId: string): Promise<ApiResponse<DashboardData>> {
    const sanitizedPartnerId = sanitizeInput(partnerId);
    const response = await this.client.request<ApiResponse<DashboardData>>(
      `/api/isp/v1/admin/partners/${sanitizedPartnerId}/dashboard`,
      {
        method: "GET",
      },
    );

    // Validate response data
    try {
      const validatedData = DashboardDataSchema.parse(response.data);
      return { ...response, data: validatedData };
    } catch (error) {
      throw new Error(`Invalid dashboard data received: ${error}`);
    }
  }

  async getCustomers(
    partnerId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    },
  ): Promise<ApiResponse<{ customers: Customer[]; total: number; pagination: any }>> {
    const sanitizedPartnerId = sanitizeInput(partnerId);

    // Validate and sanitize parameters
    const validatedParams = CustomerQueryParamsSchema.parse({
      page: params?.page,
      limit: params?.limit,
      search: params?.search ? sanitizeSearchTerm(params.search) : undefined,
      status: params?.status,
    });

    const searchParams = new URLSearchParams();
    if (validatedParams.page) searchParams.append("page", validatedParams.page.toString());
    if (validatedParams.limit) searchParams.append("limit", validatedParams.limit.toString());
    if (validatedParams.search) searchParams.append("search", validatedParams.search);
    if (validatedParams.status) searchParams.append("status", validatedParams.status);

    const response = await this.client.request<
      ApiResponse<{ customers: Customer[]; total: number; pagination: any }>
    >(`/api/isp/v1/admin/partners/${sanitizedPartnerId}/customers?${searchParams.toString()}`, {
      method: "GET",
    });

    // Validate customer data
    if (response.data?.customers) {
      response.data.customers = response.data.customers.map((customer: any) =>
        CustomerSchema.parse(customer),
      );
    }

    return response;
  }

  async getCustomer(partnerId: string, customerId: string): Promise<ApiResponse<Customer>> {
    const sanitizedPartnerId = sanitizeInput(partnerId);
    const sanitizedCustomerId = sanitizeInput(customerId);

    const response = await this.client.request<ApiResponse<Customer>>(
      `/api/isp/v1/admin/partners/${sanitizedPartnerId}/customers/${sanitizedCustomerId}`,
      {
        method: "GET",
      },
    );

    // Validate customer data
    const validatedCustomer = CustomerSchema.parse(response.data);
    return { ...response, data: validatedCustomer };
  }

  async createCustomer(
    partnerId: string,
    customerData: CreateCustomer,
  ): Promise<ApiResponse<Customer>> {
    const sanitizedPartnerId = sanitizeInput(partnerId);

    // Validate input data
    const validatedData = CreateCustomerSchema.parse(customerData);

    const response = await this.client.request<ApiResponse<Customer>>(
      `/api/isp/v1/admin/partners/${sanitizedPartnerId}/customers`,
      {
        method: "POST",
        body: JSON.stringify(validatedData),
      },
    );

    // Validate response data
    const validatedCustomer = CustomerSchema.parse(response.data);
    return { ...response, data: validatedCustomer };
  }

  async updateCustomer(
    partnerId: string,
    customerId: string,
    customerData: UpdateCustomer,
  ): Promise<ApiResponse<Customer>> {
    const sanitizedPartnerId = sanitizeInput(partnerId);
    const sanitizedCustomerId = sanitizeInput(customerId);

    // Validate input data
    const validatedData = UpdateCustomerSchema.parse(customerData);

    const response = await this.client.request<ApiResponse<Customer>>(
      `/api/isp/v1/admin/partners/${sanitizedPartnerId}/customers/${sanitizedCustomerId}`,
      {
        method: "PUT",
        body: JSON.stringify(validatedData),
      },
    );

    // Validate response data
    const validatedCustomer = CustomerSchema.parse(response.data);
    return { ...response, data: validatedCustomer };
  }

  async getCommissions(
    partnerId: string,
    params?: {
      page?: number;
      limit?: number;
      period?: string;
      status?: string;
    },
  ): Promise<
    ApiResponse<{
      commissions: CommissionRecord[];
      total: number;
      summary: any;
    }>
  > {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.period) searchParams.append("period", params.period);
    if (params?.status) searchParams.append("status", params.status);

    return this.client.request<
      ApiResponse<{ commissions: CommissionRecord[]; total: number; summary: any }>
    >(`/api/isp/v1/admin/partners/${partnerId}/commissions?${searchParams.toString()}`, {
      method: "GET",
    });
  }

  async getAnalytics(
    partnerId: string,
    params?: {
      period?: string;
      metrics?: string[];
    },
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append("period", params.period);
    if (params?.metrics) {
      params.metrics.forEach((metric) => searchParams.append("metrics", metric));
    }

    return this.client.request<ApiResponse<any>>(
      `/api/isp/v1/admin/partners/${partnerId}/analytics?${searchParams.toString()}`,
      {
        method: "GET",
      },
    );
  }

  async validateTerritory(
    partnerId: string,
    address: string,
  ): Promise<ApiResponse<{ valid: boolean; territory: string }>> {
    // Validate input data
    const validatedData = TerritoryValidationSchema.parse({
      partnerId,
      address,
    });

    return this.client.request<ApiResponse<{ valid: boolean; territory: string }>>(
      `/api/isp/v1/admin/partners/${validatedData.partnerId}/validate-territory`,
      {
        method: "POST",
        body: JSON.stringify({ address: validatedData.address }),
      },
    );
  }
}

// Lazy-loaded singleton instance to avoid initialization race conditions
let _partnerApiClient: PartnerApiClient | null = null;

export function getPartnerApiClient(): PartnerApiClient {
  if (!_partnerApiClient) {
    _partnerApiClient = new PartnerApiClient();
  }
  return _partnerApiClient;
}

// For backward compatibility, export the getter function as partnerApiClient
export { getPartnerApiClient as partnerApiClient };
