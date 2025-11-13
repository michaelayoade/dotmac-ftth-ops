/**
 * Core types for DotMac ISP Framework
 * Unified type system with consistent naming and structure
 */

// Re-export primary tenant and API types
export * from "./tenant";
export * from "../api/types/api";
export * from "./auth";
export * from "./portal-auth";
export * from "./migration";
export * from "./plugins";

// Core portal type
export type PortalType = "admin" | "customer" | "reseller" | "technician";

// Unified user interface (extends ISP UserData)
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  roles?: string[];
  tenant_id: string; // Consistent with API naming
  permissions: string[];
  avatar?: string;
  company?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// Legacy alias for backward compatibility (will be deprecated)
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  plan: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Legacy customer interface - use CustomerData from API types instead
export interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone?: string;
  address?: AddressData;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  services: ServiceData[];
  billing_info: BillingInfoData;
  created_at: string;
  updated_at: string;
}

// Legacy address interface - use AddressData from API types instead
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string; // Consistent with API naming
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Legacy service interface - use ServiceData from API types instead
export interface CustomerService {
  id: string;
  customer_id: string;
  service_id: string;
  service_name: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "CANCELLED";
  plan: string;
  bandwidth: string;
  ip_address?: string;
  installation_date?: string;
  monthly_rate: number;
  created_at: string;
  updated_at: string;
}

// Legacy billing interface - use BillingInfoData from API types instead
export interface BillingInfo {
  customer_id: string;
  billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  payment_method: "credit_card" | "bank_transfer" | "check";
  last_payment_date?: string;
  next_billing_date: string;
  balance: number;
  credit_limit: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  tax: number;
  total: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  due_date: string;
  paid_date?: string;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  service_id?: string;
}

export interface NetworkDevice {
  id: string;
  name: string;
  type: "ROUTER" | "SWITCH" | "ACCESS_POINT" | "MODEM" | "SERVER";
  ip_address: string;
  mac_address: string;
  status: "ONLINE" | "OFFLINE" | "WARNING" | "ERROR";
  location: string;
  last_seen: string;
  uptime: number;
  metrics: DeviceMetrics;
  created_at: string;
  updated_at: string;
}

export interface DeviceMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_utilization: number;
  temperature?: number;
  power_status?: "NORMAL" | "WARNING" | "CRITICAL";
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: "CUSTOMER" | "AGENT" | "SYSTEM";
  content: string;
  timestamp: string;
  status: "SENT" | "DELIVERED" | "READ";
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  url: string;
}

export interface ChatSession {
  id: string;
  customer_id: string;
  agent_id?: string;
  status: "WAITING" | "ACTIVE" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  subject?: string;
  tags: string[];
  messages: ChatMessage[];
  started_at: string;
  ended_at?: string;
  rating?: number;
  feedback?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  title: string;
  message: string;
  read: boolean;
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
}

export interface ServicePlan {
  id: string;
  name: string;
  description: string;
  type: "INTERNET" | "VOICE" | "TV" | "BUNDLE";
  bandwidth: string;
  monthly_rate: number;
  setup_fee: number;
  features: string[];
  available: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworkAlert {
  id: string;
  device_id: string;
  device_name: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  type: "CONNECTIVITY" | "PERFORMANCE" | "SECURITY" | "MAINTENANCE";
  title: string;
  description: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
}

// Note: API Response types are now imported from api/types/api.ts
// Keeping these for backward compatibility, but prefer the API types

// Legacy API response - use ApiResponse from api/types/api.ts instead
export interface LegacyApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

// Legacy paginated response - use PaginatedResponse from api/types/api.ts instead
export interface LegacyPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  trace_id?: string;
}

// Legacy query params - use QueryParams from api/types/api.ts instead
export interface LegacyQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filters?: Record<string, unknown>;
}

// Dashboard metrics
export interface DashboardMetrics {
  total_customers: number;
  active_services: number;
  monthly_revenue: number;
  network_uptime: number;
  support_tickets: {
    open: number;
    in_progress: number;
    resolved: number;
  };
  recent_alerts: NetworkAlert[];
  top_services: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
}

/*
 * MIGRATION GUIDE
 * ===============
 *
 * This file has been updated to provide a unified type system for the ISP Framework.
 *
 * BREAKING CHANGES:
 * - All field names now use snake_case for consistency with API
 * - All enum values now use UPPERCASE for consistency
 * - Deprecated interfaces are marked as "Legacy" and will be removed in future versions
 *
 * RECOMMENDED MIGRATION:
 * 1. Use ISPTenant instead of Tenant for full ISP functionality
 * 2. Use CustomerData instead of Customer for API consistency
 * 3. Use AddressData instead of Address for API consistency
 * 4. Use API types (PaginatedResponse, QueryParams, etc.) from api/types/api.ts
 * 5. Update field names from camelCase to snake_case (e.g., createdAt -> created_at)
 * 6. Update enum values from lowercase to UPPERCASE (e.g., 'active' -> 'ACTIVE')
 *
 * BACKWARD COMPATIBILITY:
 * - Legacy interfaces are maintained for backward compatibility
 * - Gradual migration is supported
 * - Both naming conventions work during transition period
 */
