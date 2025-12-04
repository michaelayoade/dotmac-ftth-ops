/**
 * Core API Types
 * Foundational types for all ISP Framework API clients
 */

// Core response structures
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number; // Consistent snake_case naming
    has_next: boolean; // Consistent snake_case naming
    has_previous: boolean; // Consistent snake_case naming
  };
  meta?: Record<string, any>;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  trace_id?: string; // Consistent snake_case naming
}

// Query parameters
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filter?: Record<string, any>;
  include?: string[];
  tenant_id?: string;
  [key: string]: any;
}

// Common data interfaces
export interface CustomerData {
  id: string;
  portal_id: string;
  company_name?: string;
  contact_name: string;
  email: string;
  phone?: string;
  address: AddressData;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
  account_type: "RESIDENTIAL" | "BUSINESS" | "ENTERPRISE";
  billing_info?: BillingInfoData;
  services: ServiceData[];
  created_at: string;
  updated_at: string;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AddressData {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface BillingInfoData {
  billing_address?: AddressData;
  payment_method_id?: string;
  billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  auto_pay: boolean;
}

export interface ServiceData {
  id: string;
  name: string;
  type: "INTERNET" | "VOICE" | "TV" | "BUNDLE";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
  plan: ServicePlanData;
  installed_date?: string;
  monthly_cost: number;
}

export interface ServicePlanData {
  id: string;
  name: string;
  description: string;
  download_speed?: number;
  upload_speed?: number;
  data_limit?: number;
  monthly_price: number;
  setup_fee?: number;
}

// Request interfaces
export interface CreateCustomerRequest {
  company_name?: string;
  contact_name: string;
  email: string;
  phone?: string;
  address: Omit<AddressData, "coordinates">;
  account_type: CustomerData["account_type"];
  initial_services?: string[];
}

export interface UpdateCustomerRequest {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: Partial<AddressData>;
  status?: CustomerData["status"];
  billing_info?: Partial<BillingInfoData>;
}

// Common filter types
export interface DateRangeFilter {
  start_date?: string;
  end_date?: string;
}

export interface StatusFilter {
  status?: string | string[];
}

export interface SearchFilter {
  search?: string;
  search_fields?: string[];
}

// Export all for easy importing
export type * from "./api";
