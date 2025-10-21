/**
 * Plugin Management Types
 * Following DRY patterns from existing type definitions
 */

export interface PluginCatalogItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "billing" | "networking" | "analytics" | "crm" | "integration" | "security" | "other";
  tags: string[];
  icon?: string;
  screenshots: string[];
  documentation_url?: string;
  support_url?: string;
  homepage?: string;
  license: string;
  pricing: {
    type: "free" | "paid" | "freemium";
    tiers?: {
      name: string;
      price: number;
      features: string[];
    }[];
  };
  compatibility: {
    min_framework_version: string;
    max_framework_version?: string;
    dependencies: string[];
  };
  permissions: {
    filesystem: string[];
    network: string[];
    database: string[];
    api: string[];
    system: string[];
  };
  security: {
    sandboxed: boolean;
    signed: boolean;
    verified: boolean;
  };
  stats: {
    downloads: number;
    rating: number;
    reviews: number;
  };
  created_at: string;
  updated_at: string;
}

export interface PluginInstallationRequest {
  plugin_id: string;
  version?: string;
  license_tier: "trial" | "basic" | "professional" | "enterprise";
  configuration?: Record<string, any>;
  auto_enable?: boolean;
}

export interface PluginInstallationResponse {
  installation_id: string;
  plugin_id: string;
  status: "pending" | "installing" | "configuring" | "completed" | "failed";
  progress: number;
  message: string;
  estimated_completion?: string;
  rollback_available: boolean;
}

export interface InstalledPlugin {
  installation_id: string;
  plugin: PluginCatalogItem;
  version: string;
  status: "active" | "inactive" | "disabled" | "error";
  installed_at: string;
  last_updated: string;
  configuration: Record<string, any>;
  license: {
    tier: string;
    expires_at?: string;
    features: string[];
  };
  usage: {
    cpu_usage: number;
    memory_usage: number;
    storage_usage: number;
    api_calls: number;
    last_activity: string;
  };
  health: {
    status: "healthy" | "warning" | "critical";
    last_check: string;
    issues: Array<{
      type: "error" | "warning" | "info";
      message: string;
      timestamp: string;
    }>;
  };
}

export interface PluginUpdateInfo {
  current_version: string;
  available_version: string;
  update_type: "major" | "minor" | "patch";
  breaking_changes: boolean;
  changelog: string;
  required_permissions: {
    filesystem: string[];
    network: string[];
    database: string[];
    api: string[];
    system: string[];
  };
  estimated_downtime: string;
}

export interface PluginMarketplaceFilters {
  category?: string[];
  tags?: string[];
  license_type?: ("free" | "paid" | "freemium")[];
  compatibility?: boolean;
  verified_only?: boolean;
  min_rating?: number;
  search?: string;
  sort_by?: "relevance" | "rating" | "downloads" | "updated" | "name";
  sort_order?: "asc" | "desc";
}

export interface PluginPermissionRequest {
  plugin_id: string;
  requested_permissions: {
    filesystem: string[];
    network: string[];
    database: string[];
    api: string[];
    system: string[];
  };
  justification: string;
}

export interface PluginBackup {
  id: string;
  plugin_id: string;
  installation_id: string;
  version: string;
  configuration: Record<string, any>;
  created_at: string;
  size: number;
  type: "manual" | "automatic" | "pre_update";
}
