/**
 * API Versioning Service - API client for API version management
 *
 * Provides methods for:
 * - Managing API versions (list, get, create, update, deprecate)
 * - Tracking version adoption and usage
 * - Managing breaking changes and deprecations
 * - Monitoring version health and migration progress
 */

import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;
const ADMIN_PREFIX = "/api/isp/v1/admin";

// ============================================
// Type Definitions
// ============================================

export type VersionStatus = "active" | "deprecated" | "sunset" | "removed";
export type VersioningStrategy = "url_path" | "header" | "query_param" | "accept_header";
export type ChangeType = "breaking" | "feature" | "bugfix" | "security" | "performance";

export interface APIVersionInfo {
  version: string; // e.g., "v1", "v2"
  major: number;
  minor?: number;
  patch?: number;
  status: VersionStatus;
  release_date: string;
  deprecation_date?: string;
  sunset_date?: string;
  removal_date?: string;
  is_default: boolean;
  is_supported: boolean;
  description?: string;
  documentation_url?: string;
  changelog_url?: string;
  migration_guide_url?: string;
  created_at: string;
  updated_at: string;
}

export interface VersionCreate {
  version: string;
  description?: string;
  release_date?: string;
  documentation_url?: string;
  changelog_url?: string;
  migration_guide_url?: string;
  is_default?: boolean;
}

export interface VersionUpdate {
  description?: string;
  documentation_url?: string;
  changelog_url?: string;
  migration_guide_url?: string;
  is_default?: boolean;
}

export interface VersionDeprecation {
  deprecation_date: string;
  sunset_date: string;
  removal_date?: string;
  reason: string;
  migration_guide_url?: string;
  replacement_version?: string;
}

export interface BreakingChange {
  id: string;
  version: string;
  change_type: ChangeType;
  title: string;
  description: string;
  affected_endpoints: string[];
  migration_steps: string[];
  before_example?: string;
  after_example?: string;
  severity: "critical" | "high" | "medium" | "low";
  created_at: string;
  updated_at: string;
}

export interface BreakingChangeCreate {
  version: string;
  change_type: ChangeType;
  title: string;
  description: string;
  affected_endpoints: string[];
  migration_steps: string[];
  before_example?: string;
  after_example?: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface BreakingChangeUpdate {
  title?: string;
  description?: string;
  affected_endpoints?: string[];
  migration_steps?: string[];
  before_example?: string;
  after_example?: string;
  severity?: "critical" | "high" | "medium" | "low";
}

export interface VersionUsageStats {
  version: string;
  request_count: number;
  unique_clients: number;
  error_rate: number;
  avg_response_time: number;
  last_used: string;
  adoption_percentage: number;
}

export interface VersionAdoptionMetrics {
  total_clients: number;
  versions: VersionUsageStats[];
  deprecated_usage: number;
  sunset_warnings: number;
  migration_progress: {
    from_version: string;
    to_version: string;
    migrated_clients: number;
    pending_clients: number;
    progress_percentage: number;
  }[];
}

export interface VersionConfiguration {
  default_version: string;
  supported_versions: string[];
  deprecated_versions: string[];
  versioning_strategy: VersioningStrategy;
  strict_mode: boolean; // Reject requests without version
  auto_upgrade: boolean; // Auto-upgrade to latest version
}

export interface VersionHealthCheck {
  version: string;
  is_healthy: boolean;
  issues: {
    type: "error" | "warning" | "info";
    message: string;
    affected_endpoints: string[];
  }[];
  endpoint_health: {
    endpoint: string;
    is_available: boolean;
    error_rate: number;
    avg_response_time: number;
  }[];
}

export interface VersionListFilters {
  status?: VersionStatus;
  is_supported?: boolean;
  include_removed?: boolean;
}

export interface BreakingChangeFilters {
  version?: string;
  change_type?: ChangeType;
  severity?: "critical" | "high" | "medium" | "low";
}

// ============================================
// Service Class
// ============================================

class VersioningService {
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
  // Version Management
  // ============================================

  /**
   * List all API versions
   *
   * @param filters - Optional filters
   * @returns List of API versions
   */
  async listVersions(filters: VersionListFilters = {}): Promise<APIVersionInfo[]> {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.is_supported !== undefined) {
      params.append("is_supported", filters.is_supported.toString());
    }
    if (filters.include_removed !== undefined) {
      params.append("include_removed", filters.include_removed.toString());
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/versions${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    const data = await this.handleResponse<{ versions: APIVersionInfo[] }>(response);
    return data.versions || [];
  }

  /**
   * Get version by ID
   *
   * @param version - Version string (e.g., "v1", "v2")
   * @returns Version details
   */
  async getVersion(version: string): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Create new API version
   *
   * @param data - Version creation data
   * @returns Created version
   */
  async createVersion(data: VersionCreate): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Update API version
   *
   * @param version - Version string
   * @param data - Update data
   * @returns Updated version
   */
  async updateVersion(version: string, data: VersionUpdate): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Deprecate API version
   *
   * @param version - Version string
   * @param data - Deprecation data
   * @returns Updated version
   */
  async deprecateVersion(version: string, data: VersionDeprecation): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}/deprecate`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Un-deprecate API version
   *
   * @param version - Version string
   * @returns Updated version
   */
  async undeprecateVersion(version: string): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}/undeprecate`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Set version as default
   *
   * @param version - Version string
   * @returns Updated version
   */
  async setDefaultVersion(version: string): Promise<APIVersionInfo> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}/set-default`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<APIVersionInfo>(response);
  }

  /**
   * Remove API version
   *
   * @param version - Version string
   */
  async removeVersion(version: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}`, {
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
  // Breaking Changes Management
  // ============================================

  /**
   * List breaking changes
   *
   * @param filters - Optional filters
   * @returns List of breaking changes
   */
  async listBreakingChanges(filters: BreakingChangeFilters = {}): Promise<BreakingChange[]> {
    const params = new URLSearchParams();

    if (filters.version) {
      params.append("version", filters.version);
    }
    if (filters.change_type) {
      params.append("change_type", filters.change_type);
    }
    if (filters.severity) {
      params.append("severity", filters.severity);
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}${ADMIN_PREFIX}/versions/breaking-changes${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    const data = await this.handleResponse<{ changes: BreakingChange[] }>(response);
    return data.changes || [];
  }

  /**
   * Get breaking change by ID
   *
   * @param changeId - Change UUID
   * @returns Breaking change details
   */
  async getBreakingChange(changeId: string): Promise<BreakingChange> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/versions/breaking-changes/${changeId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<BreakingChange>(response);
  }

  /**
   * Create breaking change
   *
   * @param data - Breaking change data
   * @returns Created breaking change
   */
  async createBreakingChange(data: BreakingChangeCreate): Promise<BreakingChange> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/breaking-changes`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<BreakingChange>(response);
  }

  /**
   * Update breaking change
   *
   * @param changeId - Change UUID
   * @param data - Update data
   * @returns Updated breaking change
   */
  async updateBreakingChange(
    changeId: string,
    data: BreakingChangeUpdate,
  ): Promise<BreakingChange> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/versions/breaking-changes/${changeId}`,
      {
        method: "PATCH",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      },
    );

    return this.handleResponse<BreakingChange>(response);
  }

  /**
   * Delete breaking change
   *
   * @param changeId - Change UUID
   */
  async deleteBreakingChange(changeId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/versions/breaking-changes/${changeId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // ============================================
  // Usage & Analytics
  // ============================================

  /**
   * Get version adoption metrics
   *
   * @param days - Number of days to analyze
   * @returns Adoption metrics
   */
  async getAdoptionMetrics(days: number = 30): Promise<VersionAdoptionMetrics> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/versions/metrics/adoption?days=${days}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<VersionAdoptionMetrics>(response);
  }

  /**
   * Get version usage statistics
   *
   * @param version - Version string
   * @param days - Number of days to analyze
   * @returns Usage statistics
   */
  async getVersionUsageStats(version: string, days: number = 30): Promise<VersionUsageStats> {
    const response = await fetch(
      `${this.baseUrl}${ADMIN_PREFIX}/versions/${version}/usage?days=${days}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include",
      },
    );

    return this.handleResponse<VersionUsageStats>(response);
  }

  /**
   * Get version health check
   *
   * @param version - Version string
   * @returns Health check results
   */
  async getVersionHealth(version: string): Promise<VersionHealthCheck> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/${version}/health`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<VersionHealthCheck>(response);
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Get versioning configuration
   *
   * @returns Current configuration
   */
  async getConfiguration(): Promise<VersionConfiguration> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/config`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<VersionConfiguration>(response);
  }

  /**
   * Update versioning configuration
   *
   * @param data - Configuration update
   * @returns Updated configuration
   */
  async updateConfiguration(data: Partial<VersionConfiguration>): Promise<VersionConfiguration> {
    const response = await fetch(`${this.baseUrl}${ADMIN_PREFIX}/versions/config`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    return this.handleResponse<VersionConfiguration>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Parse version string to components
   *
   * @param version - Version string (e.g., "v1", "v2.1", "v2.1.3")
   * @returns Version components
   */
  parseVersion(version: string): {
    major: number;
    minor?: number;
    patch?: number;
  } {
    const cleanVersion = version.replace(/^v/, "");
    const parts = cleanVersion.split(".").map((p) => parseInt(p, 10));

    const parsedVersion: { major: number; minor?: number; patch?: number } = {
      major: Number.isNaN(parts[0]) ? 0 : parts[0] || 0,
    };

    if (!Number.isNaN(parts[1]) && parts[1] !== undefined) {
      parsedVersion.minor = parts[1];
    }

    if (!Number.isNaN(parts[2]) && parts[2] !== undefined) {
      parsedVersion.patch = parts[2];
    }

    return parsedVersion;
  }

  /**
   * Compare two versions
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): number {
    const parsed1 = this.parseVersion(v1);
    const parsed2 = this.parseVersion(v2);

    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major;
    }

    const minor1 = parsed1.minor || 0;
    const minor2 = parsed2.minor || 0;
    if (minor1 !== minor2) {
      return minor1 - minor2;
    }

    const patch1 = parsed1.patch || 0;
    const patch2 = parsed2.patch || 0;
    return patch1 - patch2;
  }

  /**
   * Calculate days until sunset
   *
   * @param sunsetDate - Sunset date string
   * @returns Days until sunset
   */
  daysUntilSunset(sunsetDate: string): number {
    const sunset = new Date(sunsetDate);
    const now = new Date();
    const diff = sunset.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get version status badge color
   *
   * @param status - Version status
   * @returns Badge color class
   */
  getStatusColor(status: VersionStatus): string {
    const colorMap: Record<VersionStatus, string> = {
      active: "bg-green-500",
      deprecated: "bg-yellow-500",
      sunset: "bg-orange-500",
      removed: "bg-red-500",
    };
    return colorMap[status] || "bg-gray-500";
  }

  /**
   * Get severity badge color
   *
   * @param severity - Change severity
   * @returns Badge color class
   */
  getSeverityColor(severity: "critical" | "high" | "medium" | "low"): string {
    const colorMap = {
      critical: "bg-red-600",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colorMap[severity] || "bg-gray-500";
  }

  /**
   * Format adoption percentage
   *
   * @param adopted - Number adopted
   * @param total - Total number
   * @returns Formatted percentage string
   */
  formatAdoptionPercentage(adopted: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((adopted / total) * 100)}%`;
  }
}

// Export singleton instance
export const versioningService = new VersioningService();
