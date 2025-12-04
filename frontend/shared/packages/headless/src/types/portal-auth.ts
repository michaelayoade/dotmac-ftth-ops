/**
 * Portal ID Authentication Types - ISP Framework Integration
 * Aligns with dotmac_isp_framework Portal ID system
 */

export interface PortalAccount {
  portal_id: string; // 8-character alphanumeric ID (ABC123XY format)
  account_type: "CUSTOMER" | "TECHNICIAN" | "RESELLER";
  status: "ACTIVE" | "SUSPENDED" | "LOCKED" | "PENDING_ACTIVATION" | "DEACTIVATED";
  customer_id?: string; // For CUSTOMER accounts
  technician_id?: string; // For TECHNICIAN accounts
  reseller_id?: string; // For RESELLER accounts
  two_factor_enabled: boolean;
  password_last_changed: string;
  last_login_at?: string;
  failed_login_attempts: number;
  locked_until?: string;
}

export interface PortalSession {
  session_id: string;
  portal_id: string;
  ip_address: string;
  user_agent: string;
  device_fingerprint: string;
  geo_location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  risk_score: number; // 0-100 risk assessment
  expires_at: string;
  last_activity: string;
}

export interface PortalLoginAttempt {
  portal_id: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  failure_reason?:
    | "INVALID_PORTAL_ID"
    | "INVALID_PASSWORD"
    | "ACCOUNT_LOCKED"
    | "MFA_FAILED"
    | "SUSPENDED_ACCOUNT";
  risk_score: number;
  geo_location?: {
    country: string;
    city: string;
  };
  timestamp: string;
}

export interface PortalLoginCredentials {
  portal_id: string; // Required: 8-character Portal ID
  password: string; // Required: Account password
  mfa_code?: string; // Optional: 6-digit TOTP code
  device_fingerprint?: string; // Optional: Device identification
  remember_device?: boolean; // Optional: Remember this device
}

export interface PortalAuthResponse {
  success: boolean;
  portal_account: PortalAccount;
  session: PortalSession;
  access_token: string;
  refresh_token: string;
  customer?: CustomerData; // For CUSTOMER accounts
  technician?: TechnicianData; // For TECHNICIAN accounts
  reseller?: ResellerData; // For RESELLER accounts
  permissions: string[];
  requires_password_change?: boolean;
  requires_mfa_setup?: boolean;
}

export interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  customer_type: "RESIDENTIAL" | "BUSINESS" | "ENTERPRISE";
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  billing_address?: Address;
  service_address?: Address;
  payment_method?: PaymentMethod;
  subscription_tier: string;
  services: CustomerService[];
}

export interface TechnicianData {
  id: string;
  name: string;
  email: string;
  phone: string;
  employee_id: string;
  department: string;
  certifications: string[];
  territory: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  skills: string[];
  current_location?: [number, number];
}

export interface ResellerData {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  territory: string;
  commission_rate: number;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  license_number?: string;
  payment_terms: string;
  monthly_target?: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface PaymentMethod {
  type: "CREDIT_CARD" | "BANK_ACCOUNT" | "ACH";
  last_four: string;
  expires?: string;
  is_default: boolean;
}

export interface CustomerService {
  id: string;
  service_type: "INTERNET" | "PHONE" | "TV" | "BUNDLE";
  plan_name: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "CANCELLED";
  monthly_rate: number;
  installation_date: string;
  equipment: ServiceEquipment[];
}

export interface ServiceEquipment {
  id: string;
  type: "MODEM" | "ROUTER" | "SET_TOP_BOX" | "PHONE_ADAPTER";
  model: string;
  serial_number: string;
  status: "ACTIVE" | "INACTIVE" | "NEEDS_REPLACEMENT";
  installed_date: string;
}

export interface PortalAuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
  requires_2fa?: boolean;
  locked_until?: string;
  password_expired?: boolean;
}

export interface PortalIdValidation {
  is_valid: boolean;
  formatted: string;
  errors: string[];
}

export interface DeviceFingerprint {
  screen_resolution: string;
  timezone: string;
  language: string;
  platform: string;
  user_agent_hash: string;
  canvas_fingerprint?: string;
}

// Portal ID Generation Constants
export const PORTAL_ID_CONFIG = {
  LENGTH: 8,
  // Excludes confusing characters: 0, O, I, 1
  ALLOWED_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  VALIDATION_REGEX: /^[A-Z2-9]{8}$/,
} as const;

// Account Status Transitions
export const ACCOUNT_STATUS_TRANSITIONS = {
  PENDING_ACTIVATION: ["ACTIVE", "DEACTIVATED"],
  ACTIVE: ["SUSPENDED", "LOCKED", "DEACTIVATED"],
  SUSPENDED: ["ACTIVE", "DEACTIVATED"],
  LOCKED: ["ACTIVE", "DEACTIVATED"],
  DEACTIVATED: ["ACTIVE"],
} as const;

// Risk Score Thresholds
export const RISK_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 30,
  HIGH: 70,
  CRITICAL: 90,
} as const;
