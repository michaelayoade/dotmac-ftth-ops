/**
 * OSS Configuration Service - API client for tenant OSS integration management
 *
 * Provides methods for:
 * - Managing OSS service configurations (VOLTHA, GenieACS, NetBox, Ansible)
 * - Getting current configurations with overrides
 * - Updating tenant-specific overrides
 * - Resetting to defaults
 */

import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;
const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Type Definitions
// ============================================

export type OSSService = "voltha" | "genieacs" | "netbox" | "ansible";

export interface ServiceConfig {
  url: string;
  username?: string | null;
  password?: string | null;
  api_token?: string | null;
  verify_ssl: boolean;
  timeout_seconds: number;
  max_retries: number;
}

export interface OSSServiceConfigResponse {
  service: OSSService;
  config: ServiceConfig;
  overrides: Record<string, any>;
}

export interface OSSServiceConfigUpdate {
  url?: string | null;
  username?: string | null;
  password?: string | null;
  api_token?: string | null;
  verify_ssl?: boolean | null;
  timeout_seconds?: number | null;
  max_retries?: number | null;
}

// Service display names and descriptions
export const OSS_SERVICE_INFO: Record<
  OSSService,
  { name: string; description: string; icon: string }
> = {
  voltha: {
    name: "VOLTHA",
    description: "Virtual OLT Hardware Abstraction - PON/ONT management",
    icon: "Network",
  },
  genieacs: {
    name: "GenieACS",
    description: "TR-069 Auto Configuration Server - CPE management",
    icon: "Router",
  },
  netbox: {
    name: "NetBox",
    description: "IP Address Management and DCIM",
    icon: "Database",
  },
  ansible: {
    name: "Ansible AWX",
    description: "Automation and orchestration platform",
    icon: "Cog",
  },
};

// ============================================
// Service Class
// ============================================

class OSSConfigService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      credentials: "include",
    };
  }

  /**
   * Handle API errors consistently
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ============================================
  // OSS Configuration Management
  // ============================================

  /**
   * Get OSS configuration for a specific service
   *
   * Returns merged configuration (defaults + tenant overrides)
   *
   * @param service - OSS service name
   * @returns Service configuration with overrides
   */
  async getConfiguration(service: OSSService): Promise<OSSServiceConfigResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/tenant/oss/${service}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<OSSServiceConfigResponse>(response);
  }

  /**
   * Get configurations for all OSS services
   *
   * @returns Array of all service configurations
   */
  async getAllConfigurations(): Promise<OSSServiceConfigResponse[]> {
    const services: OSSService[] = ["voltha", "genieacs", "netbox", "ansible"];
    const promises = services.map((service) => this.getConfiguration(service));

    // Use Promise.allSettled to handle individual failures gracefully
    const results = await Promise.allSettled(promises);

    return results
      .filter(
        (result): result is PromiseFulfilledResult<OSSServiceConfigResponse> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }

  /**
   * Update OSS configuration with tenant-specific overrides
   *
   * @param service - OSS service name
   * @param updates - Partial configuration updates
   * @returns Updated service configuration
   */
  async updateConfiguration(
    service: OSSService,
    updates: OSSServiceConfigUpdate,
  ): Promise<OSSServiceConfigResponse> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/tenant/oss/${service}`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(updates),
    });

    return this.handleResponse<OSSServiceConfigResponse>(response);
  }

  /**
   * Reset OSS configuration to defaults (remove tenant overrides)
   *
   * @param service - OSS service name
   */
  async resetConfiguration(service: OSSService): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/tenant/oss/${service}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Check if a service has tenant-specific overrides
   *
   * @param config - Service configuration response
   * @returns True if overrides exist
   */
  hasOverrides(config: OSSServiceConfigResponse): boolean {
    return Object.keys(config.overrides).length > 0;
  }

  /**
   * Get list of overridden fields
   *
   * @param config - Service configuration response
   * @returns Array of overridden field names
   */
  getOverriddenFields(config: OSSServiceConfigResponse): string[] {
    return Object.keys(config.overrides);
  }

  /**
   * Validate configuration update
   *
   * @param updates - Configuration updates to validate
   * @returns Validation result with errors
   */
  validateUpdate(updates: OSSServiceConfigUpdate): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (updates.url !== undefined && updates.url !== null) {
      try {
        new URL(updates.url);
      } catch {
        errors.push("Invalid URL format");
      }
    }

    if (updates.timeout_seconds !== undefined && updates.timeout_seconds !== null) {
      if (updates.timeout_seconds < 1) {
        errors.push("Timeout must be at least 1 second");
      }
    }

    if (updates.max_retries !== undefined && updates.max_retries !== null) {
      if (updates.max_retries < 0) {
        errors.push("Max retries cannot be negative");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to OSS service (placeholder for future implementation)
   *
   * @param service - OSS service name
   * @returns Connection test result
   */
  async testConnection(service: OSSService): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    // This would call a dedicated test endpoint when available
    // For now, we just try to get the configuration
    try {
      const start = Date.now();
      await this.getConfiguration(service);
      const latency = Date.now() - start;

      return {
        success: true,
        message: "Configuration retrieved successfully",
        latency,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }
}

// Export singleton instance
export const ossConfigService = new OSSConfigService();
