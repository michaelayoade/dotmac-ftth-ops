/**
 * ISP Framework API Client
 * Refactored using composition pattern for better maintainability
 * Composes module-specific clients into unified interface
 */

import { IdentityApiClient } from "./clients/IdentityApiClient";
import { NetworkingApiClient } from "./clients/NetworkingApiClient";
import { BillingApiClient } from "./clients/BillingApiClient";
import type { PaginatedResponse, QueryParams } from "./types/api";

export interface ISPApiClientConfig {
  baseURL: string;
  apiKey?: string;
  tenantId?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

/**
 * Main ISP API Client using Composition Pattern
 * Delegates to specialized module clients
 */
export class ISPApiClient {
  private config: ISPApiClientConfig;
  private defaultHeaders: Record<string, string>;

  // Module-specific clients
  public readonly identity: IdentityApiClient;
  public readonly networking: NetworkingApiClient;
  public readonly billing: BillingApiClient;

  constructor(config: ISPApiClientConfig) {
    this.config = config;

    // Build default headers
    this.defaultHeaders = {
      "X-API-Version": "1.0",
      ...config.defaultHeaders,
    };

    if (config.apiKey) {
      this.defaultHeaders["Authorization"] = `Bearer ${config.apiKey}`;
    }

    if (config.tenantId) {
      this.defaultHeaders["X-Tenant-ID"] = config.tenantId;
    }

    // Initialize module clients
    this.identity = new IdentityApiClient(config.baseURL, this.defaultHeaders);
    this.networking = new NetworkingApiClient(config.baseURL, this.defaultHeaders);
    this.billing = new BillingApiClient(config.baseURL, this.defaultHeaders);
  }

  // Convenience methods for common operations
  async getCustomers(params?: QueryParams) {
    return this.identity.getCustomers(params);
  }

  async getCustomer(customerId: string, params?: QueryParams) {
    return this.identity.getCustomer(customerId, params);
  }

  async getNetworkDevices(params?: QueryParams) {
    return this.networking.getNetworkDevices(params);
  }

  async getBillingProcessors(params?: QueryParams) {
    return this.billing.getBillingProcessors(params);
  }

  async getTransactions(params?: QueryParams) {
    return this.billing.getTransactions(params);
  }

  // Legacy methods for backward compatibility
  async portalLogin(credentials: any) {
    return this.identity.authenticate(credentials);
  }

  async createPaymentIntent(data: any) {
    return this.billing.createPaymentIntent(data);
  }

  async getNetworkTopology(params?: any) {
    return this.networking.getNetworkTopology(params);
  }

  // Configuration methods
  updateConfig(updates: Partial<ISPApiClientConfig>) {
    this.config = { ...this.config, ...updates };

    // Update headers if needed
    if (updates.apiKey) {
      this.defaultHeaders["Authorization"] = `Bearer ${updates.apiKey}`;
    }

    if (updates.tenantId) {
      this.defaultHeaders["X-Tenant-ID"] = updates.tenantId;
    }
  }

  getConfig(): Readonly<ISPApiClientConfig> {
    return Object.freeze({ ...this.config });
  }
}

// Global instance management
let globalClient: ISPApiClient | null = null;

export function createISPApiClient(config: ISPApiClientConfig): ISPApiClient {
  return new ISPApiClient(config);
}

export function setGlobalISPApiClient(client: ISPApiClient): void {
  globalClient = client;
}

export function getISPApiClient(): ISPApiClient {
  if (!globalClient) {
    throw new Error("ISP API client not initialized. Call setGlobalISPApiClient first.");
  }
  return globalClient;
}

// Export for backward compatibility
export const ispApiClient = {
  get: () => getISPApiClient(),
  create: createISPApiClient,
  setGlobal: setGlobalISPApiClient,
};

// Re-export types for convenience
export type { PaginatedResponse, QueryParams };
