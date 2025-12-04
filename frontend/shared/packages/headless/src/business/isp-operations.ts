/**
 * ISP Business Operations Interface
 * Centralized business logic for ISP core operations
 *
 * ELIMINATES DUPLICATION across Admin, Customer, Reseller, Management, and Technician portals
 */

import { ApiClient } from "../api/client";
import { ISPError } from "../utils/errorUtils";

// ===========================
// Core Business Types
// ===========================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CustomerProfile {
  id: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "active" | "suspended" | "cancelled" | "pending";
  billingAddress: Address;
  serviceAddress: Address;
  currentPlan: ServicePlan;
  installationDate: Date;
  lastPaymentDate?: Date;
  accountBalance: number;
  creditLimit: number;
  preferences: CustomerPreferences;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
}

export interface ServicePlan {
  id: string;
  name: string;
  description: string;
  category: "residential" | "business" | "enterprise";
  downloadSpeed: number; // Mbps
  uploadSpeed: number; // Mbps
  dataLimit?: number; // GB, null for unlimited
  monthlyPrice: number;
  setupFee: number;
  contractTerm: number; // months
  features: string[];
  isActive: boolean;
}

export interface CustomerPreferences {
  preferredContactMethod: "email" | "phone" | "sms";
  billingNotifications: boolean;
  serviceNotifications: boolean;
  marketingOptIn: boolean;
  paperlessBilling: boolean;
  autoPayEnabled: boolean;
}

export interface UsageData {
  id: string;
  customerId: string;
  date: Date;
  downloadGB: number;
  uploadGB: number;
  totalGB: number;
  peakSpeed: number;
  averageSpeed: number;
  uptime: number; // percentage
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  lineItems: InvoiceLineItem[];
  paidDate?: Date;
  paymentMethod?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  serviceId?: string;
  period?: DateRange;
}

export interface ServiceStatus {
  customerId: string;
  status: "active" | "inactive" | "maintenance" | "suspended";
  uptime: number; // percentage
  lastOutage?: Date;
  currentSpeed: {
    download: number;
    upload: number;
  };
  signalStrength: number;
  deviceStatus: "online" | "offline" | "error";
  maintenanceScheduled?: Date;
}

export interface MaintenanceRequest {
  customerId: string;
  type: "scheduled" | "emergency" | "upgrade";
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  scheduledStart: Date;
  estimatedDuration: number; // minutes
  affectedServices?: string[];
  technicianId?: string;
}

export interface MaintenanceWindow {
  id: string;
  customerId: string;
  type: MaintenanceRequest["type"];
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  description: string;
  technicianId: string;
  notes?: string;
  affectedCustomers: string[];
}

export interface DiagnosticsResult {
  customerId: string;
  timestamp: Date;
  overall: "healthy" | "warning" | "error";
  tests: DiagnosticTest[];
  recommendations: string[];
  automatedFixes: AutomatedFix[];
}

export interface DiagnosticTest {
  name: string;
  status: "pass" | "warning" | "fail";
  value?: string | number;
  expectedValue?: string | number;
  description: string;
}

export interface AutomatedFix {
  id: string;
  description: string;
  applied: boolean;
  success?: boolean;
  error?: string;
}

export interface NetworkStatus {
  overall: "healthy" | "degraded" | "outage";
  uptime: number;
  activeDevices: number;
  totalDevices: number;
  bandwidth: {
    total: number;
    used: number;
    percentage: number;
  };
  alerts: NetworkAlert[];
  regions: RegionStatus[];
}

export interface RegionStatus {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "outage";
  customers: number;
  activeCustomers: number;
  averageSpeed: number;
}

export interface NetworkAlert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  type: "outage" | "performance" | "maintenance" | "security";
  message: string;
  timestamp: Date;
  region?: string;
  affectedCustomers?: number;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface DeviceStatus {
  id: string;
  type: "router" | "switch" | "access_point" | "modem" | "tower";
  name: string;
  location: string;
  status: "online" | "offline" | "warning" | "error";
  uptime: number;
  lastSeen: Date;
  version: string;
  temperature?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  connectedClients?: number;
  throughput: {
    in: number;
    out: number;
  };
}

export interface DeviceConfig {
  name?: string;
  settings: Record<string, any>;
  firmware?: {
    version: string;
    autoUpdate: boolean;
  };
  networking?: {
    ip: string;
    subnet: string;
    gateway: string;
    dns: string[];
  };
  wifi?: {
    ssid: string;
    password: string;
    channel: number;
    bandwidth: "20MHz" | "40MHz" | "80MHz" | "160MHz";
  };
}

export interface RevenueParams {
  dateRange: DateRange;
  resellerId?: string;
  region?: string;
  serviceType?: string;
  includeProjections?: boolean;
}

export interface RevenueData {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  projectedRevenue?: number;
  breakdown: {
    byServiceType: Record<string, number>;
    byRegion: Record<string, number>;
    byCustomerType: Record<string, number>;
  };
  growth: {
    monthOverMonth: number;
    yearOverYear: number;
  };
}

export interface PaymentRequest {
  customerId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  invoiceId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  id: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  amount: number;
  transactionId?: string;
  failureReason?: string;
  processedAt?: Date;
  fees?: {
    processing: number;
    gateway: number;
  };
}

export interface Commission {
  id: string;
  resellerId: string;
  customerId: string;
  period: DateRange;
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  bonuses: CommissionBonus[];
  totalAmount: number;
  status: "calculated" | "approved" | "paid" | "disputed";
  paidDate?: Date;
}

export interface CommissionBonus {
  type: "new_customer" | "retention" | "upgrade" | "volume" | "performance";
  amount: number;
  description: string;
}

// ===========================
// ISP Business Operations Interface
// ===========================

export interface ISPBusinessOperations {
  // Customer Management (Used in: Admin, Customer, Reseller, Management)
  customerService: {
    getCustomerProfile(customerId: string): Promise<CustomerProfile>;
    updateCustomerProfile(
      customerId: string,
      updates: Partial<CustomerProfile>,
    ): Promise<CustomerProfile>;
    updateServicePlan(customerId: string, planId: string): Promise<void>;
    getUsageHistory(customerId: string, period: DateRange): Promise<UsageData[]>;
    getBillingHistory(
      customerId: string,
      filters?: { limit?: number; status?: string },
    ): Promise<Invoice[]>;
    suspendService(customerId: string, reason: string): Promise<void>;
    reactivateService(customerId: string): Promise<void>;
    calculateUsageCost(customerId: string, period: DateRange): Promise<number>;
  };

  // Service Management (Used in: Admin, Customer, Technician)
  serviceOperations: {
    getServiceStatus(customerId: string): Promise<ServiceStatus>;
    scheduleMaintenanceWindow(params: MaintenanceRequest): Promise<MaintenanceWindow>;
    troubleshootConnection(customerId: string): Promise<DiagnosticsResult>;
    applyAutomatedFix(customerId: string, fixId: string): Promise<boolean>;
    getMaintenanceHistory(customerId: string): Promise<MaintenanceWindow[]>;
    getServicePlans(filters?: { category?: string; active?: boolean }): Promise<ServicePlan[]>;
    upgradeService(customerId: string, newPlanId: string): Promise<void>;
  };

  // Network Operations (Used in: Admin, Technician, Management)
  networkOperations: {
    getNetworkHealth(): Promise<NetworkStatus>;
    getRegionStatus(regionId: string): Promise<RegionStatus>;
    getDeviceStatus(deviceId: string): Promise<DeviceStatus>;
    configureDevice(deviceId: string, config: DeviceConfig): Promise<void>;
    restartDevice(deviceId: string): Promise<boolean>;
    getNetworkAlerts(filters?: { severity?: string; resolved?: boolean }): Promise<NetworkAlert[]>;
    resolveAlert(alertId: string, notes?: string): Promise<void>;
    getNetworkMetrics(period: DateRange): Promise<Record<string, any>>;
  };

  // Billing Operations (Used in: Admin, Customer, Reseller, Management)
  billingOperations: {
    calculateRevenue(params: RevenueParams): Promise<RevenueData>;
    processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult>;
    generateCommissions(resellerId: string, period: DateRange): Promise<Commission[]>;
    createInvoice(customerId: string, lineItems: Omit<InvoiceLineItem, "id">[]): Promise<Invoice>;
    sendInvoice(invoiceId: string): Promise<void>;
    applyPayment(invoiceId: string, paymentId: string): Promise<void>;
    generateStatement(customerId: string, period: DateRange): Promise<any>;
    calculateCommissionTiers(resellerId: string): Promise<any>;
  };
}

// ===========================
// Implementation
// ===========================

export class ISPBusinessService implements ISPBusinessOperations {
  constructor(private apiClient: ApiClient) {}

  // Customer Service Operations
  customerService = {
    apiClient: this.apiClient,
    async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
      try {
        const response = await this.apiClient.request<{
          data: CustomerProfile;
        }>(`/customers/${customerId}/profile`);
        if (!response.data) {
          throw new ISPError({
            message: "Customer profile not found",
            category: "business",
            severity: "medium",
            context: `customerId: ${customerId}`,
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to get customer profile: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async updateCustomerProfile(
      customerId: string,
      updates: Partial<CustomerProfile>,
    ): Promise<CustomerProfile> {
      try {
        const response = await this.apiClient.request<{
          data: CustomerProfile;
        }>(`/customers/${customerId}/profile`, {
          method: "PUT",
          body: JSON.stringify(updates),
        });
        if (!response.data) {
          throw new ISPError({
            message: "Failed to update customer profile",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to update customer profile: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, updates },
        });
      }
    },

    async updateServicePlan(customerId: string, planId: string): Promise<void> {
      try {
        await this.apiClient.request(`/customers/${customerId}/service-plan`, {
          method: "PUT",
          body: JSON.stringify({ planId }),
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to update service plan: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `customerId: ${customerId}, planId: ${planId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async getUsageHistory(customerId: string, period: DateRange): Promise<UsageData[]> {
      try {
        const response = await this.apiClient.request<{ data: UsageData[] }>(
          `/customers/${customerId}/usage`,
          {
            params: {
              startDate: period.startDate.toISOString(),
              endDate: period.endDate.toISOString(),
            },
          },
        );
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Failed to get usage history: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, period },
        });
      }
    },

    async getBillingHistory(
      customerId: string,
      filters: { limit?: number; status?: string } = {},
    ): Promise<Invoice[]> {
      try {
        const response = await this.apiClient.request<{ data: Invoice[] }>(
          `/customers/${customerId}/invoices`,
          {
            params: filters,
          },
        );
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Failed to get billing history: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, filters },
        });
      }
    },

    async suspendService(customerId: string, reason: string): Promise<void> {
      try {
        await this.apiClient.request(`/customers/${customerId}/service/suspend`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to suspend service: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `customerId: ${customerId}, reason: ${reason}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async reactivateService(customerId: string): Promise<void> {
      try {
        await this.apiClient.request(`/customers/${customerId}/service/reactivate`, {
          method: "POST",
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to reactivate service: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async calculateUsageCost(customerId: string, period: DateRange): Promise<number> {
      try {
        const response = await this.apiClient.request<{
          data: { cost: number };
        }>(`/customers/${customerId}/usage/cost`, {
          params: {
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString(),
          },
        });
        return response.data?.cost || 0;
      } catch (error) {
        throw new ISPError({
          message: `Failed to calculate usage cost: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, period },
        });
      }
    },
  };

  // Service Operations
  serviceOperations = {
    apiClient: this.apiClient,
    async getServiceStatus(customerId: string): Promise<ServiceStatus> {
      try {
        const response = await this.apiClient.request<{ data: ServiceStatus }>(
          `/customers/${customerId}/service/status`,
        );
        if (!response.data) {
          throw new ISPError({
            message: "Service status not found",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to get service status: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async scheduleMaintenanceWindow(params: MaintenanceRequest): Promise<MaintenanceWindow> {
      try {
        const response = await this.apiClient.request<{
          data: MaintenanceWindow;
        }>("/maintenance/schedule", {
          method: "POST",
          body: JSON.stringify(params),
        });
        if (!response.data) {
          throw new ISPError({
            message: "Failed to schedule maintenance",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to schedule maintenance: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          technicalDetails: { originalError: error, params },
        });
      }
    },

    async troubleshootConnection(customerId: string): Promise<DiagnosticsResult> {
      try {
        const response = await this.apiClient.request<{
          data: DiagnosticsResult;
        }>(`/customers/${customerId}/diagnostics`, {
          method: "POST",
        });
        if (!response.data) {
          throw new ISPError({
            message: "Diagnostics failed to run",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Connection troubleshooting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async applyAutomatedFix(customerId: string, fixId: string): Promise<boolean> {
      try {
        const response = await this.apiClient.request<{
          data: { success: boolean };
        }>(`/customers/${customerId}/diagnostics/fix/${fixId}`, {
          method: "POST",
        });
        return response.data?.success || false;
      } catch (error) {
        throw new ISPError({
          message: `Failed to apply automated fix: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}, fixId: ${fixId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async getMaintenanceHistory(customerId: string): Promise<MaintenanceWindow[]> {
      try {
        const response = await this.apiClient.request<{
          data: MaintenanceWindow[];
        }>(`/customers/${customerId}/maintenance/history`);
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Failed to get maintenance history: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async getServicePlans(
      filters: { category?: string; active?: boolean } = {},
    ): Promise<ServicePlan[]> {
      try {
        const response = await this.apiClient.request<{ data: ServicePlan[] }>("/service-plans", {
          params: filters,
        });
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Failed to get service plans: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          technicalDetails: { originalError: error, filters },
        });
      }
    },

    async upgradeService(customerId: string, newPlanId: string): Promise<void> {
      try {
        await this.apiClient.request(`/customers/${customerId}/service/upgrade`, {
          method: "POST",
          body: JSON.stringify({ planId: newPlanId }),
        });
      } catch (error) {
        throw new ISPError({
          message: `Service upgrade failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `customerId: ${customerId}, newPlanId: ${newPlanId}`,
          technicalDetails: { originalError: error },
        });
      }
    },
  };

  // Network Operations
  networkOperations = {
    apiClient: this.apiClient,
    async getNetworkHealth(): Promise<NetworkStatus> {
      try {
        const response = await this.apiClient.request<{ data: NetworkStatus }>("/network/health");
        if (!response.data) {
          throw new ISPError({
            message: "Network health data not available",
            category: "system",
            severity: "high",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to get network health: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "system",
          severity: "high",
          technicalDetails: { originalError: error },
        });
      }
    },

    async getRegionStatus(regionId: string): Promise<RegionStatus> {
      try {
        const response = await this.apiClient.request<{ data: RegionStatus }>(
          `/network/regions/${regionId}/status`,
        );
        if (!response.data) {
          throw new ISPError({
            message: "Region status not found",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to get region status: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `regionId: ${regionId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
      try {
        const response = await this.apiClient.request<{ data: DeviceStatus }>(
          `/network/devices/${deviceId}/status`,
        );
        if (!response.data) {
          throw new ISPError({
            message: "Device status not found",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Failed to get device status: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `deviceId: ${deviceId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async configureDevice(deviceId: string, config: DeviceConfig): Promise<void> {
      try {
        await this.apiClient.request(`/network/devices/${deviceId}/configure`, {
          method: "POST",
          body: JSON.stringify(config),
        });
      } catch (error) {
        throw new ISPError({
          message: `Device configuration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `deviceId: ${deviceId}`,
          technicalDetails: { originalError: error, config },
        });
      }
    },

    async restartDevice(deviceId: string): Promise<boolean> {
      try {
        const response = await this.apiClient.request<{
          data: { success: boolean };
        }>(`/network/devices/${deviceId}/restart`, {
          method: "POST",
        });
        return response.data?.success || false;
      } catch (error) {
        throw new ISPError({
          message: `Device restart failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `deviceId: ${deviceId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async getNetworkAlerts(
      filters: { severity?: string; resolved?: boolean } = {},
    ): Promise<NetworkAlert[]> {
      try {
        const response = await this.apiClient.request<{ data: NetworkAlert[] }>("/network/alerts", {
          params: filters,
        });
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Failed to get network alerts: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "system",
          severity: "medium",
          technicalDetails: { originalError: error, filters },
        });
      }
    },

    async resolveAlert(alertId: string, notes?: string): Promise<void> {
      try {
        await this.apiClient.request(`/network/alerts/${alertId}/resolve`, {
          method: "POST",
          body: JSON.stringify({ notes }),
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to resolve alert: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `alertId: ${alertId}`,
          technicalDetails: { originalError: error, notes },
        });
      }
    },

    async getNetworkMetrics(period: DateRange): Promise<Record<string, any>> {
      try {
        const response = await this.apiClient.request<{
          data: Record<string, any>;
        }>("/network/metrics", {
          params: {
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString(),
          },
        });
        return response.data || {};
      } catch (error) {
        throw new ISPError({
          message: `Failed to get network metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "system",
          severity: "medium",
          technicalDetails: { originalError: error, period },
        });
      }
    },
  };

  // Billing Operations
  billingOperations = {
    apiClient: this.apiClient,
    async calculateRevenue(params: RevenueParams): Promise<RevenueData> {
      try {
        const response = await this.apiClient.request<{ data: RevenueData }>(
          "/billing/revenue/calculate",
          {
            method: "POST",
            body: JSON.stringify(params),
          },
        );
        if (!response.data) {
          throw new ISPError({
            message: "Revenue calculation failed",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Revenue calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          technicalDetails: { originalError: error, params },
        });
      }
    },

    async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
      try {
        const response = await this.apiClient.request<{ data: PaymentResult }>(
          "/billing/payments/process",
          {
            method: "POST",
            body: JSON.stringify(paymentRequest),
          },
        );
        if (!response.data) {
          throw new ISPError({
            message: "Payment processing failed",
            category: "business",
            severity: "high",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Payment processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          technicalDetails: {
            originalError: error,
            paymentRequest: {
              ...paymentRequest,
              paymentMethodId: "[REDACTED]",
            },
          },
        });
      }
    },

    async generateCommissions(resellerId: string, period: DateRange): Promise<Commission[]> {
      try {
        const response = await this.apiClient.request<{ data: Commission[] }>(
          "/billing/commissions/generate",
          {
            method: "POST",
            body: JSON.stringify({
              resellerId,
              startDate: period.startDate.toISOString(),
              endDate: period.endDate.toISOString(),
            }),
          },
        );
        return response.data || [];
      } catch (error) {
        throw new ISPError({
          message: `Commission generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `resellerId: ${resellerId}`,
          technicalDetails: { originalError: error, period },
        });
      }
    },

    async createInvoice(
      customerId: string,
      lineItems: Omit<InvoiceLineItem, "id">[],
    ): Promise<Invoice> {
      try {
        const response = await this.apiClient.request<{ data: Invoice }>(
          "/billing/invoices/create",
          {
            method: "POST",
            body: JSON.stringify({ customerId, lineItems }),
          },
        );
        if (!response.data) {
          throw new ISPError({
            message: "Invoice creation failed",
            category: "business",
            severity: "medium",
          });
        }
        return response.data;
      } catch (error) {
        throw new ISPError({
          message: `Invoice creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, lineItems },
        });
      }
    },

    async sendInvoice(invoiceId: string): Promise<void> {
      try {
        await this.apiClient.request(`/billing/invoices/${invoiceId}/send`, {
          method: "POST",
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to send invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `invoiceId: ${invoiceId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async applyPayment(invoiceId: string, paymentId: string): Promise<void> {
      try {
        await this.apiClient.request(`/billing/invoices/${invoiceId}/apply-payment`, {
          method: "POST",
          body: JSON.stringify({ paymentId }),
        });
      } catch (error) {
        throw new ISPError({
          message: `Failed to apply payment to invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "high",
          context: `invoiceId: ${invoiceId}, paymentId: ${paymentId}`,
          technicalDetails: { originalError: error },
        });
      }
    },

    async generateStatement(customerId: string, period: DateRange): Promise<any> {
      try {
        const response = await this.apiClient.request<{ data: any }>(
          `/billing/customers/${customerId}/statement`,
          {
            params: {
              startDate: period.startDate.toISOString(),
              endDate: period.endDate.toISOString(),
            },
          },
        );
        return response.data || {};
      } catch (error) {
        throw new ISPError({
          message: `Statement generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `customerId: ${customerId}`,
          technicalDetails: { originalError: error, period },
        });
      }
    },

    async calculateCommissionTiers(resellerId: string): Promise<any> {
      try {
        const response = await this.apiClient.request<{ data: any }>(
          `/billing/resellers/${resellerId}/commission-tiers`,
        );
        return response.data || {};
      } catch (error) {
        throw new ISPError({
          message: `Commission tier calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "business",
          severity: "medium",
          context: `resellerId: ${resellerId}`,
          technicalDetails: { originalError: error },
        });
      }
    },
  };
}

// ===========================
// Factory Function
// ===========================

/**
 * Creates a new ISP Business Operations service instance
 */
export function createISPBusinessService(apiClient: ApiClient): ISPBusinessOperations {
  return new ISPBusinessService(apiClient);
}

// ===========================
// Hook for React Components
// ===========================

export function useISPBusiness(apiClient?: ApiClient): ISPBusinessOperations {
  // This will be enhanced with React hooks when integrated
  if (!apiClient) {
    throw new ISPError({
      message: "API client is required for ISP business operations",
      category: "system",
      severity: "high",
    });
  }
  return createISPBusinessService(apiClient);
}
