/**
 * Identity Management API Client
 * Handles customer, user, and authentication operations
 */

import { BaseApiClient } from "./BaseApiClient";
import type {
  PaginatedResponse,
  QueryParams,
  CustomerData,
  UserData,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "../types/api";

export class IdentityApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Customer operations
  async getCustomers(params?: QueryParams): Promise<PaginatedResponse<CustomerData>> {
    return this.get("/api/identity/customers", { params });
  }

  async getCustomer(customerId: string, params?: QueryParams): Promise<{ data: CustomerData }> {
    return this.get(`/api/identity/customers/${customerId}`, { params });
  }

  async createCustomer(data: CreateCustomerRequest): Promise<{ data: CustomerData }> {
    return this.post("/api/identity/customers", data);
  }

  async updateCustomer(
    customerId: string,
    data: UpdateCustomerRequest,
  ): Promise<{ data: CustomerData }> {
    return this.put(`/api/identity/customers/${customerId}`, data);
  }

  async deleteCustomer(customerId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/identity/customers/${customerId}`);
  }

  // User operations
  async getUsers(params?: QueryParams): Promise<PaginatedResponse<UserData>> {
    return this.get("/api/identity/users", { params });
  }

  async getUser(userId: string): Promise<{ data: UserData }> {
    return this.get(`/api/identity/users/${userId}`);
  }

  async createUser(data: any): Promise<{ data: UserData }> {
    return this.post("/api/identity/users", data);
  }

  async updateUser(userId: string, data: any): Promise<{ data: UserData }> {
    return this.put(`/api/identity/users/${userId}`, data);
  }

  async updateUserPermissions(userId: string, permissions: string[]): Promise<{ data: UserData }> {
    return this.put(`/api/identity/users/${userId}/permissions`, { permissions });
  }

  async deleteUser(userId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/identity/users/${userId}`);
  }

  // Portal ID operations
  async generatePortalId(customerId: string): Promise<{ data: any }> {
    return this.post(`/api/identity/customers/${customerId}/portal-id`);
  }

  async validatePortalId(portalId: string): Promise<{ data: any }> {
    return this.get(`/api/identity/portal-id/${portalId}/validate`);
  }

  // Authentication operations
  async authenticate(credentials: any): Promise<{ data: any }> {
    return this.post("/api/identity/auth/login", credentials);
  }

  async logout(): Promise<{ success: boolean }> {
    return this.post("/api/identity/auth/logout", {});
  }

  async refreshToken(refreshToken: string): Promise<{ data: any }> {
    return this.post("/api/identity/auth/refresh", {
      refresh_token: refreshToken,
    });
  }

  async loginWithPortalId(portalId: string, password: string): Promise<{ data: any }> {
    return this.post("/api/identity/auth/portal-login", {
      portal_id: portalId,
      password,
    });
  }
}
