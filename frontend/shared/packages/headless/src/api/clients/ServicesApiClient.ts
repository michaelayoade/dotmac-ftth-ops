/**
 * Services Management API Client
 * Handles service provisioning, lifecycle management, and configuration
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams, ServiceData, ServicePlanData } from "../types/api";

export interface ServiceOrder {
  id: string;
  customer_id: string;
  service_plan_id: string;
  status: "PENDING" | "APPROVED" | "PROVISIONING" | "ACTIVE" | "CANCELLED";
  installation_date?: string;
  installation_address: string;
  technical_requirements?: Record<string, any>;
  monthly_cost: number;
  setup_fee: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceProvisioning {
  id: string;
  service_order_id: string;
  status: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  steps: ProvisioningStep[];
  assigned_technician?: string;
  completion_date?: string;
  notes?: string;
}

export interface ProvisioningStep {
  id: string;
  name: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  description: string;
  estimated_duration: number;
  actual_duration?: number;
  dependencies?: string[];
}

export class ServicesApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Service Plans
  async getServicePlans(params?: QueryParams): Promise<PaginatedResponse<ServicePlanData>> {
    return this.get("/api/services/plans", { params });
  }

  async getServicePlan(planId: string): Promise<{ data: ServicePlanData }> {
    return this.get(`/api/services/plans/${planId}`);
  }

  async createServicePlan(data: Omit<ServicePlanData, "id">): Promise<{ data: ServicePlanData }> {
    return this.post("/api/services/plans", data);
  }

  async updateServicePlan(
    planId: string,
    data: Partial<ServicePlanData>,
  ): Promise<{ data: ServicePlanData }> {
    return this.put(`/api/services/plans/${planId}`, data);
  }

  // Customer Services
  async getCustomerServices(
    customerId: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<ServiceData>> {
    return this.get(`/api/services/customers/${customerId}/services`, {
      params,
    });
  }

  async activateService(customerId: string, serviceId: string): Promise<{ data: ServiceData }> {
    return this.post(`/api/services/customers/${customerId}/services/${serviceId}/activate`, {});
  }

  async suspendService(
    customerId: string,
    serviceId: string,
    reason?: string,
  ): Promise<{ data: ServiceData }> {
    return this.post(`/api/services/customers/${customerId}/services/${serviceId}/suspend`, {
      reason,
    });
  }

  async terminateService(
    customerId: string,
    serviceId: string,
    termination_date?: string,
  ): Promise<{ success: boolean }> {
    return this.post(`/api/services/customers/${customerId}/services/${serviceId}/terminate`, {
      termination_date,
    });
  }

  // Service Orders
  async createServiceOrder(
    data: Omit<ServiceOrder, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: ServiceOrder }> {
    return this.post("/api/services/orders", data);
  }

  async getServiceOrders(params?: QueryParams): Promise<PaginatedResponse<ServiceOrder>> {
    return this.get("/api/services/orders", { params });
  }

  async getServiceOrder(orderId: string): Promise<{ data: ServiceOrder }> {
    return this.get(`/api/services/orders/${orderId}`);
  }

  async updateServiceOrder(
    orderId: string,
    data: Partial<ServiceOrder>,
  ): Promise<{ data: ServiceOrder }> {
    return this.put(`/api/services/orders/${orderId}`, data);
  }

  async approveServiceOrder(orderId: string, notes?: string): Promise<{ data: ServiceOrder }> {
    return this.post(`/api/services/orders/${orderId}/approve`, { notes });
  }

  async cancelServiceOrder(orderId: string, reason: string): Promise<{ data: ServiceOrder }> {
    return this.post(`/api/services/orders/${orderId}/cancel`, { reason });
  }

  // Service Provisioning
  async getProvisioningStatus(orderIds: string[]): Promise<{ data: ServiceProvisioning[] }> {
    return this.post("/api/services/provisioning/status", {
      order_ids: orderIds,
    });
  }

  async updateProvisioningStep(
    provisioningId: string,
    stepId: string,
    data: Partial<ProvisioningStep>,
  ): Promise<{ data: ProvisioningStep }> {
    return this.put(`/api/services/provisioning/${provisioningId}/steps/${stepId}`, data);
  }

  // Service Configuration
  async getServiceConfiguration(serviceId: string): Promise<{ data: Record<string, any> }> {
    return this.get(`/api/services/${serviceId}/configuration`);
  }

  async updateServiceConfiguration(
    serviceId: string,
    config: Record<string, any>,
  ): Promise<{ data: Record<string, any> }> {
    return this.put(`/api/services/${serviceId}/configuration`, config);
  }

  // Usage and Metrics
  async getServiceUsage(
    serviceId: string,
    params?: { start_date?: string; end_date?: string },
  ): Promise<{ data: any }> {
    return this.get(`/api/services/${serviceId}/usage`, { params });
  }

  async getServiceMetrics(
    serviceId: string,
    params?: { metrics?: string[]; period?: string },
  ): Promise<{ data: any }> {
    return this.get(`/api/services/${serviceId}/metrics`, { params });
  }
}
