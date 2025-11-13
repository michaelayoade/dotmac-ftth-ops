/**
 * ISP Framework Multi-Tenant Types
 * Aligned with dotmac_isp_framework tenant architecture
 */

export interface ISPTenant {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE" | "TRIAL" | "EXPIRED";

  // Subscription and billing
  subscription: {
    plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "CUSTOM";
    status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIAL";
    trial_ends_at?: string;
    current_period_start: string;
    current_period_end: string;
    billing_cycle: "MONTHLY" | "YEARLY";
    max_customers: number;
    max_services: number;
    max_users: number;
  };

  // ISP-specific configuration
  isp_config: {
    company_name: string;
    company_type: "WISP" | "FIBER" | "CABLE" | "CELLULAR" | "SATELLITE" | "HYBRID";
    license_number?: string;
    service_area: string;
    time_zone: string;
    currency: string;
    locale: string;

    // Network configuration
    network: {
      default_dns: string[];
      radius_server?: string;
      snmp_community?: string;
      ipam_range?: string;
    };

    // Portal configuration
    portals: {
      customer_portal: {
        enabled: boolean;
        domain?: string;
        subdomain?: string;
        custom_css?: string;
        features: string[];
      };
      reseller_portal: {
        enabled: boolean;
        domain?: string;
        commission_structure: "FLAT" | "PERCENTAGE" | "TIERED";
      };
      technician_portal: {
        enabled: boolean;
        mobile_app_enabled: boolean;
        gps_tracking: boolean;
      };
    };
  };

  // Branding and customization
  branding: {
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    favicon_url?: string;
    custom_css?: string;
    email_templates: Record<string, string>;
    white_label: boolean;
  };

  // Feature entitlements
  features: {
    // Core modules
    identity: boolean;
    billing: boolean;
    services: boolean;
    networking: boolean;
    support: boolean;

    // Advanced modules
    sales: boolean;
    resellers: boolean;
    analytics: boolean;
    inventory: boolean;
    field_ops: boolean;
    compliance: boolean;
    notifications: boolean;

    // Premium features
    advanced_reporting: boolean;
    api_access: boolean;
    white_labeling: boolean;
    custom_integrations: boolean;
    sla_management: boolean;
    multi_language: boolean;
  };

  // Limits and quotas
  limits: {
    customers: number;
    services: number;
    users: number;
    api_requests_per_hour: number;
    storage_gb: number;
    bandwidth_gb: number;
  };

  // Current usage
  usage: {
    customers: number;
    services: number;
    users: number;
    api_requests_this_hour: number;
    storage_used_gb: number;
    bandwidth_used_gb: number;
  };

  // Contact and billing information
  contact: {
    primary_contact: {
      name: string;
      email: string;
      phone: string;
      role: string;
    };
    billing_contact?: {
      name: string;
      email: string;
      phone: string;
    };
    technical_contact?: {
      name: string;
      email: string;
      phone: string;
    };

    address: {
      street: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
  };

  // Integration settings
  integrations: {
    payment_processor?: {
      provider: "STRIPE" | "PAYPAL" | "AUTHORIZE_NET" | "SQUARE";
      live_mode: boolean;
      webhook_url: string;
    };
    email_service?: {
      provider: "SENDGRID" | "MAILGUN" | "SES" | "SMTP";
      from_address: string;
      from_name: string;
    };
    sms_service?: {
      provider: "TWILIO" | "NEXMO" | "AWS_SNS";
    };
    backup_service?: {
      provider: "AWS_S3" | "GOOGLE_CLOUD" | "AZURE";
      bucket: string;
      retention_days: number;
    };
  };

  // Metadata
  created_at: string;
  updated_at: string;
  last_activity_at?: string;
  created_by: string;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
  permissions: string[];
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantSession {
  tenant: ISPTenant;
  user: TenantUser | null;
  portal_type?: "ADMIN" | "CUSTOMER" | "RESELLER" | "TECHNICIAN";
  permissions?: string[];
  features?: string[];
  limits?: Record<string, number>;
  branding?: {
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    company_name: string;
    white_label: boolean;
  };
  isActive?: boolean;
  expiresAt?: string;
  lastActivity?: string;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantPermissions {
  // Identity module permissions
  "identity.users.read": boolean;
  "identity.users.write": boolean;
  "identity.users.delete": boolean;
  "identity.customers.read": boolean;
  "identity.customers.write": boolean;
  "identity.customers.delete": boolean;

  // Billing module permissions
  "billing.invoices.read": boolean;
  "billing.invoices.write": boolean;
  "billing.payments.read": boolean;
  "billing.payments.process": boolean;

  // Services module permissions
  "services.catalog.read": boolean;
  "services.catalog.write": boolean;
  "services.provision": boolean;
  "services.suspend": boolean;
  "services.terminate": boolean;

  // Networking module permissions
  "networking.devices.read": boolean;
  "networking.devices.write": boolean;
  "networking.ipam.read": boolean;
  "networking.ipam.allocate": boolean;
  "networking.monitoring.read": boolean;

  // Support module permissions
  "support.tickets.read": boolean;
  "support.tickets.write": boolean;
  "support.tickets.assign": boolean;
  "support.kb.read": boolean;
  "support.kb.write": boolean;

  // Sales module permissions
  "sales.leads.read": boolean;
  "sales.leads.write": boolean;
  "sales.campaigns.read": boolean;
  "sales.campaigns.write": boolean;

  // Reseller module permissions
  "resellers.read": boolean;
  "resellers.write": boolean;
  "resellers.commissions.read": boolean;
  "resellers.commissions.process": boolean;

  // Analytics module permissions
  "analytics.reports.read": boolean;
  "analytics.reports.create": boolean;
  "analytics.data.export": boolean;

  // Inventory module permissions
  "inventory.items.read": boolean;
  "inventory.items.write": boolean;
  "inventory.procurement.read": boolean;
  "inventory.procurement.write": boolean;

  // Field operations permissions
  "field_ops.work_orders.read": boolean;
  "field_ops.work_orders.write": boolean;
  "field_ops.technicians.read": boolean;
  "field_ops.technicians.assign": boolean;

  // Administrative permissions
  "admin.settings.read": boolean;
  "admin.settings.write": boolean;
  "admin.users.manage": boolean;
  "admin.billing.manage": boolean;
  "admin.integrations.manage": boolean;
}

export interface TenantLimitsUsage {
  customers: { limit: number; used: number; percentage: number };
  services: { limit: number; used: number; percentage: number };
  users: { limit: number; used: number; percentage: number };
  api_requests: { limit: number; used: number; percentage: number };
  storage: { limit: number; used: number; percentage: number };
  bandwidth: { limit: number; used: number; percentage: number };
}

export interface TenantBranding {
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  company_name: string;
  white_label: boolean;
  custom_css?: string;
  email_signature?: string;
}

export interface TenantNotification {
  id: string;
  type: "BILLING" | "LIMIT_WARNING" | "FEATURE_UPDATE" | "MAINTENANCE" | "SECURITY";
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  action_required: boolean;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  read_at?: string;
  read: boolean;
}

export type TenantPlan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "CUSTOM";
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE" | "TRIAL" | "EXPIRED";
export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
export type PortalType = "ADMIN" | "CUSTOMER" | "RESELLER" | "TECHNICIAN";
