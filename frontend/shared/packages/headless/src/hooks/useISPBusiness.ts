/**
 * ISP Business Operations Hook
 * React hook for accessing centralized ISP business logic across all portals
 *
 * ELIMINATES DUPLICATION - Single source of truth for business operations
 */

import { useMemo, useCallback } from "react";
import { useApiClient } from "./useApiClient";
import type { ApiClient } from "../api/client";
import { createISPBusinessService, type ISPBusinessOperations } from "../business/isp-operations";
import type {
  CustomerProfile,
  ServiceStatus,
  NetworkStatus,
  RevenueData,
  UsageData,
  Invoice,
  ServicePlan,
  MaintenanceWindow,
  DiagnosticsResult,
  DeviceStatus,
  PaymentResult,
  Commission,
  DateRange,
  MaintenanceRequest,
  PaymentRequest,
  RevenueParams,
  InvoiceLineItem,
} from "../business/isp-operations";

export interface UseISPBusinessOptions {
  portal?: "admin" | "customer" | "reseller" | "management" | "technician";
  tenantId?: string;
  resellerId?: string;
}

export interface UseISPBusinessReturn extends ISPBusinessOperations {
  apiClient: ApiClient;
  // Convenience methods for common operations
  customerOperations: {
    // Customer Portal - frequently used operations
    getMyProfile: (customerId: string) => Promise<CustomerProfile>;
    getMyUsage: (customerId: string, period: DateRange) => Promise<UsageData[]>;
    getMyBills: (customerId: string) => Promise<Invoice[]>;
    getMyServiceStatus: (customerId: string) => Promise<ServiceStatus>;

    // Admin/Management Portal - bulk operations
    getCustomerOverview: (customerId: string) => Promise<{
      profile: CustomerProfile;
      status: ServiceStatus;
      usage: UsageData[];
      bills: Invoice[];
    }>;

    // Reseller Portal - territory management
    getMyCustomers: (resellerId: string) => Promise<CustomerProfile[]>;
    getResellerMetrics: (
      resellerId: string,
      period: DateRange,
    ) => Promise<{
      totalCustomers: number;
      activeCustomers: number;
      revenue: RevenueData;
      commissions: Commission[];
    }>;
  };

  // Technician-specific operations
  technicianOperations: {
    getWorkOrders: (technicianId: string) => Promise<MaintenanceWindow[]>;
    completeWorkOrder: (workOrderId: string, notes: string) => Promise<void>;
    runDiagnostics: (customerId: string) => Promise<DiagnosticsResult>;
    getDeviceList: (regionId?: string) => Promise<DeviceStatus[]>;
  };

  // Admin-specific operations
  adminOperations: {
    getSystemOverview: () => Promise<{
      networkHealth: NetworkStatus;
      totalCustomers: number;
      totalRevenue: RevenueData;
      activeTickets: number;
    }>;
    bulkCustomerOperation: (
      customerIds: string[],
      operation: "suspend" | "reactivate",
    ) => Promise<void>;
  };

  // Management Portal operations
  managementOperations: {
    getDashboardData: (period: DateRange) => Promise<{
      revenue: RevenueData;
      networkHealth: NetworkStatus;
      customerGrowth: number;
      servicePerformance: any;
    }>;
    generateReports: (
      type: "financial" | "operational" | "customer",
      period: DateRange,
    ) => Promise<any>;
  };
}

/**
 * Main hook for ISP business operations
 * Provides portal-optimized business logic with DRY compliance
 */
export function useISPBusiness(options: UseISPBusinessOptions = {}): UseISPBusinessReturn {
  const { portal, tenantId, resellerId } = options;
  const metadata: Record<string, unknown> = {};

  if (portal) {
    metadata.portal = portal;
  }

  if (resellerId) {
    metadata.resellerId = resellerId;
  }

  const apiClientConfig =
    tenantId || Object.keys(metadata).length
      ? {
          ...(tenantId ? { tenantId } : {}),
          ...(Object.keys(metadata).length ? { metadata } : {}),
        }
      : undefined;

  const apiClient = useApiClient(apiClientConfig);

  // Create the business service instance
  const businessService = useMemo(() => {
    return createISPBusinessService(apiClient);
  }, [apiClient]);

  // Customer convenience operations
  const customerOperations = useMemo(
    () => ({
      getMyProfile: async (customerId: string) => {
        return businessService.customerService.getCustomerProfile(customerId);
      },

      getMyUsage: async (customerId: string, period: DateRange) => {
        return businessService.customerService.getUsageHistory(customerId, period);
      },

      getMyBills: async (customerId: string) => {
        return businessService.customerService.getBillingHistory(customerId, {
          limit: 12,
        });
      },

      getMyServiceStatus: async (customerId: string) => {
        return businessService.serviceOperations.getServiceStatus(customerId);
      },

      getCustomerOverview: async (customerId: string) => {
        // Parallel requests for better performance
        const [profile, status, usage, bills] = await Promise.all([
          businessService.customerService.getCustomerProfile(customerId),
          businessService.serviceOperations.getServiceStatus(customerId),
          businessService.customerService.getUsageHistory(customerId, {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            endDate: new Date(),
          }),
          businessService.customerService.getBillingHistory(customerId, {
            limit: 6,
          }),
        ]);

        return { profile, status, usage, bills };
      },

      getMyCustomers: async (resellerId: string) => {
        // This would be implemented to get customers by reseller
        const response = await apiClient.request<{ data: CustomerProfile[] }>(
          `/resellers/${resellerId}/customers`,
        );
        return response.data || [];
      },

      getResellerMetrics: async (resellerId: string, period: DateRange) => {
        const [customers, revenue, commissions] = await Promise.all([
          apiClient.request<{ data: CustomerProfile[] }>(`/resellers/${resellerId}/customers`),
          businessService.billingOperations.calculateRevenue({
            dateRange: period,
            resellerId,
          }),
          businessService.billingOperations.generateCommissions(resellerId, period),
        ]);

        const customerData = customers.data || [];
        return {
          totalCustomers: customerData.length,
          activeCustomers: customerData.filter((c) => c.status === "active").length,
          revenue,
          commissions,
        };
      },
    }),
    [businessService, apiClient],
  );

  // Technician convenience operations
  const technicianOperations = useMemo(
    () => ({
      getWorkOrders: async (technicianId: string) => {
        const response = await apiClient.request<{ data: MaintenanceWindow[] }>(
          `/technicians/${technicianId}/work-orders`,
        );
        return response.data || [];
      },

      completeWorkOrder: async (workOrderId: string, notes: string) => {
        await apiClient.request(`/maintenance/${workOrderId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            notes,
            completedAt: new Date().toISOString(),
          }),
        });
      },

      runDiagnostics: async (customerId: string) => {
        return businessService.serviceOperations.troubleshootConnection(customerId);
      },

      getDeviceList: async (regionId?: string) => {
        const params = regionId ? { regionId } : undefined;
        const response = await apiClient.request<{ data: DeviceStatus[] }>("/network/devices", {
          params,
        });
        return response.data || [];
      },
    }),
    [businessService, apiClient],
  );

  // Admin convenience operations
  const adminOperations = useMemo(
    () => ({
      getSystemOverview: async () => {
        const [networkHealth, customersResponse, revenue] = await Promise.all([
          businessService.networkOperations.getNetworkHealth(),
          apiClient.request<{ data: { total: number } }>("/customers/count"),
          businessService.billingOperations.calculateRevenue({
            dateRange: {
              startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              endDate: new Date(),
            },
          }),
        ]);

        return {
          networkHealth,
          totalCustomers: customersResponse.data?.total || 0,
          totalRevenue: revenue,
          activeTickets: 0, // Would be implemented
        };
      },

      bulkCustomerOperation: async (customerIds: string[], operation: "suspend" | "reactivate") => {
        const promises = customerIds.map((customerId) => {
          if (operation === "suspend") {
            return businessService.customerService.suspendService(customerId, "Bulk admin action");
          } else {
            return businessService.customerService.reactivateService(customerId);
          }
        });

        await Promise.all(promises);
      },
    }),
    [businessService, apiClient],
  );

  // Management Portal operations
  const managementOperations = useMemo(
    () => ({
      getDashboardData: async (period: DateRange) => {
        const [revenue, networkHealth, customerGrowthResponse] = await Promise.all([
          businessService.billingOperations.calculateRevenue({
            dateRange: period,
          }),
          businessService.networkOperations.getNetworkHealth(),
          apiClient.request<{ data: { growth: number } }>("/analytics/customer-growth", {
            params: {
              startDate: period.startDate.toISOString(),
              endDate: period.endDate.toISOString(),
            },
          }),
        ]);

        return {
          revenue,
          networkHealth,
          customerGrowth: customerGrowthResponse.data?.growth || 0,
          servicePerformance: {}, // Would be implemented
        };
      },

      generateReports: async (
        type: "financial" | "operational" | "customer",
        period: DateRange,
      ) => {
        const response = await apiClient.request<{ data: any }>(`/reports/${type}`, {
          params: {
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString(),
          },
        });
        return response.data || {};
      },
    }),
    [businessService, apiClient],
  );

  return {
    apiClient,
    // Core business operations
    ...businessService,

    // Portal-optimized convenience methods
    customerOperations,
    technicianOperations,
    adminOperations,
    managementOperations,
  };
}

// ===========================
// Specialized Portal Hooks
// ===========================

/**
 * Customer Portal optimized hook
 */
export function useCustomerBusiness(customerId: string) {
  const business = useISPBusiness({ portal: "customer" });

  return {
    ...business,
    // Pre-bound methods for customer portal
    getMyProfile: useCallback(
      () => business.customerOperations.getMyProfile(customerId),
      [business, customerId],
    ),
    getMyUsage: useCallback(
      (period: DateRange) => business.customerOperations.getMyUsage(customerId, period),
      [business, customerId],
    ),
    getMyBills: useCallback(
      () => business.customerOperations.getMyBills(customerId),
      [business, customerId],
    ),
    getMyServiceStatus: useCallback(
      () => business.customerOperations.getMyServiceStatus(customerId),
      [business, customerId],
    ),
    upgradeMyService: useCallback(
      (planId: string) => business.serviceOperations.upgradeService(customerId, planId),
      [business, customerId],
    ),
    payBill: useCallback(
      (paymentRequest: PaymentRequest) => business.billingOperations.processPayment(paymentRequest),
      [business],
    ),
  };
}

/**
 * Reseller Portal optimized hook
 */
export function useResellerBusiness(resellerId: string) {
  const business = useISPBusiness({ portal: "reseller", resellerId });

  return {
    ...business,
    // Pre-bound methods for reseller portal
    getMyCustomers: useCallback(
      () => business.customerOperations.getMyCustomers(resellerId),
      [business, resellerId],
    ),
    getMyCommissions: useCallback(
      (period: DateRange) => business.billingOperations.generateCommissions(resellerId, period),
      [business, resellerId],
    ),
    getMyMetrics: useCallback(
      (period: DateRange) => business.customerOperations.getResellerMetrics(resellerId, period),
      [business, resellerId],
    ),
    addNewCustomer: useCallback(
      async (customerData: Partial<CustomerProfile>) => {
        // Implementation would be added
        const response = await business.apiClient.request<{
          data: CustomerProfile;
        }>("/customers", {
          method: "POST",
          body: JSON.stringify({ ...customerData, resellerId }),
        });
        return response.data!;
      },
      [business, resellerId],
    ),
  };
}

/**
 * Technician Portal optimized hook
 */
export function useTechnicianBusiness(technicianId: string) {
  const business = useISPBusiness({ portal: "technician" });

  return {
    ...business,
    // Pre-bound methods for technician portal
    getMyWorkOrders: useCallback(
      () => business.technicianOperations.getWorkOrders(technicianId),
      [business, technicianId],
    ),
    completeWorkOrder: useCallback(
      (workOrderId: string, notes: string) =>
        business.technicianOperations.completeWorkOrder(workOrderId, notes),
      [business],
    ),
    diagnoseCustomer: useCallback(
      (customerId: string) => business.technicianOperations.runDiagnostics(customerId),
      [business],
    ),
    getMyDevices: useCallback(
      (regionId?: string) => business.technicianOperations.getDeviceList(regionId),
      [business],
    ),
    scheduleJob: useCallback(
      (request: MaintenanceRequest) =>
        business.serviceOperations.scheduleMaintenanceWindow(request),
      [business],
    ),
  };
}

/**
 * Admin Portal optimized hook
 */
export function useAdminBusiness() {
  const business = useISPBusiness({ portal: "admin" });

  return {
    ...business,
    // Pre-bound methods for admin portal
    getSystemOverview: useCallback(() => business.adminOperations.getSystemOverview(), [business]),
    bulkSuspendCustomers: useCallback(
      (customerIds: string[]) =>
        business.adminOperations.bulkCustomerOperation(customerIds, "suspend"),
      [business],
    ),
    bulkReactivateCustomers: useCallback(
      (customerIds: string[]) =>
        business.adminOperations.bulkCustomerOperation(customerIds, "reactivate"),
      [business],
    ),
    getNetworkHealth: useCallback(() => business.networkOperations.getNetworkHealth(), [business]),
    getAllAlerts: useCallback(() => business.networkOperations.getNetworkAlerts(), [business]),
  };
}

/**
 * Management Portal optimized hook
 */
export function useManagementBusiness() {
  const business = useISPBusiness({ portal: "management" });

  return {
    ...business,
    // Pre-bound methods for management portal
    getDashboard: useCallback(
      (period: DateRange) => business.managementOperations.getDashboardData(period),
      [business],
    ),
    getFinancialReport: useCallback(
      (period: DateRange) => business.managementOperations.generateReports("financial", period),
      [business],
    ),
    getOperationalReport: useCallback(
      (period: DateRange) => business.managementOperations.generateReports("operational", period),
      [business],
    ),
    getCustomerReport: useCallback(
      (period: DateRange) => business.managementOperations.generateReports("customer", period),
      [business],
    ),
  };
}

// Export types for consumers
export type {
  CustomerProfile,
  ServiceStatus,
  NetworkStatus,
  RevenueData,
  UsageData,
  Invoice,
  ServicePlan,
  MaintenanceWindow,
  DiagnosticsResult,
  DeviceStatus,
  PaymentResult,
  Commission,
  DateRange,
  MaintenanceRequest,
  PaymentRequest,
  RevenueParams,
  InvoiceLineItem,
} from "../business/isp-operations";
