/**
 * Licensing & Software Activation API Client
 * Handles software licensing, activation, and compliance management
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface SoftwareLicense {
  id: string;
  license_key: string;
  product_id: string;
  product_name: string;
  product_version: string;
  license_type: "PERPETUAL" | "SUBSCRIPTION" | "TRIAL" | "EVALUATION" | "CONCURRENT" | "NAMED_USER";
  license_model: "PER_SEAT" | "PER_DEVICE" | "PER_CPU" | "PER_CORE" | "SITE_LICENSE" | "ENTERPRISE";
  customer_id?: string;
  reseller_id?: string;
  issued_to: string;
  max_activations: number;
  current_activations: number;
  features: LicenseFeature[];
  restrictions: LicenseRestriction[];
  issued_date: string;
  activation_date?: string;
  expiry_date?: string;
  maintenance_expiry?: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "PENDING";
  auto_renewal: boolean;
  trial_period_days?: number;
  grace_period_days?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LicenseFeature {
  feature_id: string;
  feature_name: string;
  enabled: boolean;
  limit_value?: number;
  limit_type?: "COUNT" | "SIZE" | "DURATION" | "BANDWIDTH";
  expires_at?: string;
}

export interface LicenseRestriction {
  restriction_type:
    | "GEOGRAPHIC"
    | "DOMAIN"
    | "IP_RANGE"
    | "MAC_ADDRESS"
    | "HARDWARE_ID"
    | "TIME_BASED";
  values: string[];
  operator: "ALLOW" | "DENY";
}

export interface Activation {
  id: string;
  license_id: string;
  activation_token: string;
  device_fingerprint: string;
  machine_name?: string;
  hardware_id?: string;
  mac_address?: string;
  ip_address?: string;
  operating_system?: string;
  user_agent?: string;
  application_version: string;
  activation_type: "ONLINE" | "OFFLINE" | "EMERGENCY";
  status: "ACTIVE" | "DEACTIVATED" | "SUSPENDED" | "EXPIRED";
  activated_at: string;
  last_heartbeat?: string;
  deactivated_at?: string;
  deactivation_reason?: string;
  location?: ActivationLocation;
  usage_metrics?: UsageMetrics;
}

export interface ActivationLocation {
  country: string;
  region?: string;
  city?: string;
  timezone: string;
  coordinates?: { latitude: number; longitude: number };
}

export interface UsageMetrics {
  total_runtime_hours: number;
  feature_usage: Record<string, number>;
  api_calls_count: number;
  data_processed_mb: number;
  last_used_at: string;
  peak_concurrent_users?: number;
}

export interface LicenseTemplate {
  id: string;
  template_name: string;
  product_id: string;
  description: string;
  license_type: SoftwareLicense["license_type"];
  license_model: SoftwareLicense["license_model"];
  default_duration: number;
  max_activations: number;
  features: TemplateFeature[];
  restrictions: TemplateRestriction[];
  pricing: LicensePricing;
  auto_renewal_enabled: boolean;
  trial_allowed: boolean;
  trial_duration_days: number;
  grace_period_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateFeature {
  feature_id: string;
  feature_name: string;
  included: boolean;
  default_limit?: number;
  configurable: boolean;
  required: boolean;
}

export interface TemplateRestriction {
  restriction_type: LicenseRestriction["restriction_type"];
  operator: LicenseRestriction["operator"];
  configurable: boolean;
  default_values?: string[];
}

export interface LicensePricing {
  base_price: number;
  currency: string;
  billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "ONE_TIME";
  per_seat_price?: number;
  volume_discounts?: VolumeDiscount[];
  maintenance_percentage?: number;
}

export interface VolumeDiscount {
  min_quantity: number;
  max_quantity?: number;
  discount_percentage: number;
  discount_amount?: number;
}

export interface LicenseOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  reseller_id?: string;
  template_id: string;
  quantity: number;
  custom_features?: LicenseFeature[];
  custom_restrictions?: LicenseRestriction[];
  duration_override?: number;
  pricing_override?: Partial<LicensePricing>;
  special_instructions?: string;
  status: "PENDING" | "APPROVED" | "FULFILLED" | "CANCELLED";
  total_amount: number;
  discount_applied?: number;
  payment_status: "PENDING" | "PAID" | "PARTIAL" | "FAILED" | "REFUNDED";
  fulfillment_method: "AUTO" | "MANUAL" | "BATCH";
  generated_licenses?: string[];
  created_at: string;
  fulfilled_at?: string;
}

export interface ComplianceAudit {
  id: string;
  audit_type: "SCHEDULED" | "RANDOM" | "COMPLAINT_DRIVEN" | "RENEWAL";
  customer_id?: string;
  product_ids: string[];
  audit_scope: "FULL" | "PARTIAL" | "SPOT_CHECK";
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  auditor_id: string;
  audit_date: string;
  findings: AuditFinding[];
  violations: ComplianceViolation[];
  compliance_score: number;
  recommendations: string[];
  follow_up_required: boolean;
  follow_up_date?: string;
  report_url?: string;
  created_at: string;
  completed_at?: string;
}

export interface AuditFinding {
  finding_type:
    | "OVER_DEPLOYMENT"
    | "UNLICENSED_SOFTWARE"
    | "EXPIRED_LICENSE"
    | "FEATURE_MISUSE"
    | "DOCUMENTATION_MISSING";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  evidence: string[];
  affected_licenses: string[];
  impact_assessment: string;
  recommended_action: string;
}

export interface ComplianceViolation {
  violation_type:
    | "UNAUTHORIZED_USE"
    | "OVER_DEPLOYMENT"
    | "FEATURE_ABUSE"
    | "TRANSFER_VIOLATION"
    | "REVERSE_ENGINEERING";
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  license_id: string;
  description: string;
  detected_at: string;
  evidence: string[];
  financial_impact?: number;
  resolution_required: boolean;
  resolution_deadline?: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISPUTED";
}

export interface LicenseUsageReport {
  report_id: string;
  customer_id?: string;
  product_id?: string;
  report_period: { start_date: string; end_date: string };
  license_summary: {
    total_licenses: number;
    active_licenses: number;
    expired_licenses: number;
    suspended_licenses: number;
  };
  activation_summary: {
    total_activations: number;
    active_activations: number;
    peak_concurrent_activations: number;
    average_utilization: number;
  };
  feature_usage: Array<{
    feature_name: string;
    total_usage: number;
    unique_users: number;
    peak_usage: number;
  }>;
  compliance_status: "COMPLIANT" | "NON_COMPLIANT" | "REQUIRES_REVIEW";
  recommendations: string[];
  generated_at: string;
}

export class LicensingApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // License Management
  async getLicenses(
    params?: QueryParams & {
      customer_id?: string;
      product_id?: string;
      status?: string;
      license_type?: string;
      expiry_date_from?: string;
      expiry_date_to?: string;
    },
  ): Promise<PaginatedResponse<SoftwareLicense>> {
    return this.get("/api/licensing/licenses", { params });
  }

  async getLicense(licenseId: string): Promise<{ data: SoftwareLicense }> {
    return this.get(`/api/licensing/licenses/${licenseId}`);
  }

  async getLicenseByKey(licenseKey: string): Promise<{ data: SoftwareLicense }> {
    return this.get(`/api/licensing/licenses/by-key/${licenseKey}`);
  }

  async createLicense(
    data: Omit<
      SoftwareLicense,
      "id" | "license_key" | "current_activations" | "created_at" | "updated_at"
    >,
  ): Promise<{ data: SoftwareLicense }> {
    return this.post("/api/licensing/licenses", data);
  }

  async updateLicense(
    licenseId: string,
    data: Partial<SoftwareLicense>,
  ): Promise<{ data: SoftwareLicense }> {
    return this.put(`/api/licensing/licenses/${licenseId}`, data);
  }

  async renewLicense(
    licenseId: string,
    data: {
      duration_months: number;
      extend_maintenance?: boolean;
      upgrade_features?: LicenseFeature[];
    },
  ): Promise<{ data: SoftwareLicense }> {
    return this.post(`/api/licensing/licenses/${licenseId}/renew`, data);
  }

  async suspendLicense(licenseId: string, reason: string): Promise<{ data: SoftwareLicense }> {
    return this.post(`/api/licensing/licenses/${licenseId}/suspend`, {
      reason,
    });
  }

  async revokeLicense(licenseId: string, reason: string): Promise<{ data: SoftwareLicense }> {
    return this.post(`/api/licensing/licenses/${licenseId}/revoke`, { reason });
  }

  async transferLicense(
    licenseId: string,
    data: {
      new_customer_id?: string;
      new_issued_to: string;
      transfer_reason: string;
      deactivate_existing: boolean;
    },
  ): Promise<{ data: SoftwareLicense }> {
    return this.post(`/api/licensing/licenses/${licenseId}/transfer`, data);
  }

  // Activation Management
  async activateLicense(data: {
    license_key: string;
    device_fingerprint: string;
    machine_name?: string;
    hardware_id?: string;
    activation_type?: Activation["activation_type"];
    metadata?: Record<string, any>;
  }): Promise<{ data: Activation }> {
    return this.post("/api/licensing/activations", data);
  }

  async getActivations(
    params?: QueryParams & {
      license_id?: string;
      status?: string;
      device_fingerprint?: string;
    },
  ): Promise<PaginatedResponse<Activation>> {
    return this.get("/api/licensing/activations", { params });
  }

  async getActivation(activationId: string): Promise<{ data: Activation }> {
    return this.get(`/api/licensing/activations/${activationId}`);
  }

  async validateActivation(activationToken: string): Promise<{
    data: {
      valid: boolean;
      activation?: Activation;
      license?: SoftwareLicense;
    };
  }> {
    return this.post("/api/licensing/activations/validate", {
      activation_token: activationToken,
    });
  }

  async deactivateLicense(activationId: string, reason?: string): Promise<{ data: Activation }> {
    return this.post(`/api/licensing/activations/${activationId}/deactivate`, {
      reason,
    });
  }

  async sendHeartbeat(
    activationToken: string,
    metrics?: Partial<UsageMetrics>,
  ): Promise<{ data: { status: string; message?: string } }> {
    return this.post("/api/licensing/activations/heartbeat", {
      activation_token: activationToken,
      metrics,
    });
  }

  async getOfflineActivationRequest(
    licenseKey: string,
    deviceFingerprint: string,
  ): Promise<{ data: { request_code: string; instructions: string } }> {
    return this.post("/api/licensing/activations/offline-request", {
      license_key: licenseKey,
      device_fingerprint: deviceFingerprint,
    });
  }

  async processOfflineActivation(
    requestCode: string,
    responseCode: string,
  ): Promise<{ data: Activation }> {
    return this.post("/api/licensing/activations/offline-activate", {
      request_code: requestCode,
      response_code: responseCode,
    });
  }

  // License Templates
  async getTemplates(params?: QueryParams): Promise<PaginatedResponse<LicenseTemplate>> {
    return this.get("/api/licensing/templates", { params });
  }

  async getTemplate(templateId: string): Promise<{ data: LicenseTemplate }> {
    return this.get(`/api/licensing/templates/${templateId}`);
  }

  async createTemplate(
    data: Omit<LicenseTemplate, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: LicenseTemplate }> {
    return this.post("/api/licensing/templates", data);
  }

  async updateTemplate(
    templateId: string,
    data: Partial<LicenseTemplate>,
  ): Promise<{ data: LicenseTemplate }> {
    return this.put(`/api/licensing/templates/${templateId}`, data);
  }

  async duplicateTemplate(templateId: string, newName: string): Promise<{ data: LicenseTemplate }> {
    return this.post(`/api/licensing/templates/${templateId}/duplicate`, {
      new_name: newName,
    });
  }

  // License Orders
  async getOrders(params?: QueryParams): Promise<PaginatedResponse<LicenseOrder>> {
    return this.get("/api/licensing/orders", { params });
  }

  async getOrder(orderId: string): Promise<{ data: LicenseOrder }> {
    return this.get(`/api/licensing/orders/${orderId}`);
  }

  async createOrder(
    data: Omit<LicenseOrder, "id" | "order_number" | "status" | "total_amount" | "created_at">,
  ): Promise<{ data: LicenseOrder }> {
    return this.post("/api/licensing/orders", data);
  }

  async approveOrder(orderId: string, approvalNotes?: string): Promise<{ data: LicenseOrder }> {
    return this.post(`/api/licensing/orders/${orderId}/approve`, {
      approval_notes: approvalNotes,
    });
  }

  async fulfillOrder(orderId: string): Promise<{ data: LicenseOrder }> {
    return this.post(`/api/licensing/orders/${orderId}/fulfill`, {});
  }

  async cancelOrder(orderId: string, reason: string): Promise<{ data: LicenseOrder }> {
    return this.post(`/api/licensing/orders/${orderId}/cancel`, { reason });
  }

  // Compliance & Auditing
  async getComplianceAudits(params?: QueryParams): Promise<PaginatedResponse<ComplianceAudit>> {
    return this.get("/api/licensing/compliance/audits", { params });
  }

  async getComplianceAudit(auditId: string): Promise<{ data: ComplianceAudit }> {
    return this.get(`/api/licensing/compliance/audits/${auditId}`);
  }

  async scheduleComplianceAudit(data: {
    customer_id?: string;
    product_ids: string[];
    audit_type: ComplianceAudit["audit_type"];
    audit_scope: ComplianceAudit["audit_scope"];
    audit_date: string;
    special_instructions?: string;
  }): Promise<{ data: ComplianceAudit }> {
    return this.post("/api/licensing/compliance/audits", data);
  }

  async submitAuditFindings(
    auditId: string,
    findings: AuditFinding[],
  ): Promise<{ data: ComplianceAudit }> {
    return this.post(`/api/licensing/compliance/audits/${auditId}/findings`, {
      findings,
    });
  }

  async resolveComplianceViolation(
    violationId: string,
    data: {
      resolution_action: string;
      resolution_notes: string;
      evidence?: string[];
    },
  ): Promise<{ data: ComplianceViolation }> {
    return this.post(`/api/licensing/compliance/violations/${violationId}/resolve`, data);
  }

  async getComplianceStatus(customerId: string): Promise<{
    data: {
      overall_score: number;
      license_compliance: number;
      feature_compliance: number;
      activation_compliance: number;
      violations: ComplianceViolation[];
      recommendations: string[];
    };
  }> {
    return this.get(`/api/licensing/compliance/status/${customerId}`);
  }

  // Usage Analytics & Reporting
  async generateUsageReport(params: {
    customer_id?: string;
    product_id?: string;
    start_date: string;
    end_date: string;
    report_format: "JSON" | "PDF" | "CSV";
    include_details?: boolean;
  }): Promise<{
    data: {
      report_id: string;
      download_url?: string;
      report_data?: LicenseUsageReport;
    };
  }> {
    return this.post("/api/licensing/reports/usage", params);
  }

  async getLicenseUtilization(params?: {
    customer_id?: string;
    product_id?: string;
    time_period?: "DAY" | "WEEK" | "MONTH" | "QUARTER";
  }): Promise<{
    data: {
      total_licenses: number;
      utilized_licenses: number;
      utilization_percentage: number;
      peak_utilization: number;
      underutilized_licenses: Array<{
        license_id: string;
        utilization: number;
      }>;
    };
  }> {
    return this.get("/api/licensing/analytics/utilization", { params });
  }

  async getFeatureUsageAnalytics(params?: {
    product_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    data: Array<{
      feature_name: string;
      total_usage_hours: number;
      unique_licenses: number;
      average_usage_per_license: number;
      peak_concurrent_usage: number;
    }>;
  }> {
    return this.get("/api/licensing/analytics/feature-usage", { params });
  }

  async getExpiryAlerts(daysAhead: number = 30): Promise<{
    data: Array<{
      license_id: string;
      customer_name: string;
      product_name: string;
      expiry_date: string;
      days_remaining: number;
      auto_renewal_enabled: boolean;
    }>;
  }> {
    return this.get("/api/licensing/alerts/expiring", {
      params: { days_ahead: daysAhead },
    });
  }

  // License Validation & Security
  async validateLicenseKey(licenseKey: string): Promise<{
    data: {
      valid: boolean;
      license?: SoftwareLicense;
      validation_details: any;
    };
  }> {
    return this.post("/api/licensing/validate", { license_key: licenseKey });
  }

  async checkLicenseIntegrity(
    licenseKey: string,
    signature?: string,
  ): Promise<{
    data: { integrity_check: boolean; tampering_detected: boolean };
  }> {
    return this.post("/api/licensing/integrity-check", {
      license_key: licenseKey,
      signature,
    });
  }

  async generateEmergencyCode(
    licenseKey: string,
    reason: string,
  ): Promise<{ data: { emergency_code: string; valid_until: string } }> {
    return this.post("/api/licensing/emergency-code", {
      license_key: licenseKey,
      reason,
    });
  }

  async blacklistDevice(
    deviceFingerprint: string,
    reason: string,
  ): Promise<{ data: { success: boolean } }> {
    return this.post("/api/licensing/security/blacklist-device", {
      device_fingerprint: deviceFingerprint,
      reason,
    });
  }

  async reportSuspiciousActivity(data: {
    license_key?: string;
    activation_token?: string;
    activity_type: "MULTIPLE_ACTIVATIONS" | "UNUSUAL_LOCATION" | "TAMPERING_ATTEMPT" | "API_ABUSE";
    description: string;
    evidence?: Record<string, any>;
  }): Promise<{ data: { incident_id: string } }> {
    return this.post("/api/licensing/security/report-activity", data);
  }
}
