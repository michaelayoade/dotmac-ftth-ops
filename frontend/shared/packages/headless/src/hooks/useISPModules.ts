/**
 * ISP Framework Modules Hook
 * Provides access to all 13 ISP Framework modules through React hooks
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getISPApiClient } from "../api/isp-client";
import type { QueryParams } from "../types";
import type { GeoLocation } from "../api/clients/FieldOpsApiClient";

export function useISPModules() {
  const queryClient = useQueryClient();
  const ispClient = getISPApiClient();

  // ============================================================================
  // 1. Identity Module Hooks
  // ============================================================================

  const useUsers = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["identity", "users", params],
      queryFn: () => ispClient.getUsers(params),
    });
  };

  const useUser = (id: string) => {
    return useQuery({
      queryKey: ["identity", "users", id],
      queryFn: () => ispClient.getUser(id),
      enabled: !!id,
    });
  };

  const useCustomers = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["identity", "customers", params],
      queryFn: () => ispClient.getCustomers(params),
    });
  };

  const useCustomer = (id: string) => {
    return useQuery({
      queryKey: ["identity", "customers", id],
      queryFn: () => ispClient.getCustomer(id),
      enabled: !!id,
    });
  };

  const useCreateCustomer = () => {
    return useMutation({
      mutationFn: (customerData: any) => ispClient.createCustomer(customerData),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["identity", "customers"] });
      },
    });
  };

  // ============================================================================
  // 2. Billing Module Hooks
  // ============================================================================

  const useInvoices = (customerId?: string, params?: QueryParams) => {
    const queryParams = customerId ? { ...(params || {}), customerId } : params;
    return useQuery({
      queryKey: ["billing", "invoices", customerId, params],
      queryFn: () => ispClient.getInvoices(queryParams),
    });
  };

  const useInvoice = (id: string) => {
    return useQuery({
      queryKey: ["billing", "invoices", id],
      queryFn: () => ispClient.getInvoice(id),
      enabled: !!id,
    });
  };

  const usePayments = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["billing", "payments", params],
      queryFn: () => ispClient.getPayments(params),
    });
  };

  const useProcessPayment = () => {
    return useMutation({
      mutationFn: (paymentData: any) => ispClient.processPayment(paymentData),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["billing", "payments"] });
        queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      },
    });
  };

  const useSubscriptions = (customerId?: string) => {
    return useQuery({
      queryKey: ["billing", "subscriptions", customerId],
      queryFn: () => ispClient.getSubscriptions(customerId),
    });
  };

  // ============================================================================
  // 3. Services Module Hooks
  // ============================================================================

  const useServiceCatalog = () => {
    return useQuery({
      queryKey: ["services", "catalog"],
      queryFn: () => ispClient.getServiceCatalog(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useServiceInstances = (customerId?: string) => {
    return useQuery({
      queryKey: ["services", "instances", customerId],
      queryFn: () => ispClient.getServiceInstances(customerId),
    });
  };

  const useProvisionService = () => {
    return useMutation({
      mutationFn: (serviceData: any) => ispClient.provisionService(serviceData),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["services", "instances"] });
      },
    });
  };

  const useUsageTracking = (serviceId: string, period?: string) => {
    return useQuery({
      queryKey: ["services", "usage", serviceId, period],
      queryFn: () => ispClient.getUsageTracking(serviceId, period),
      enabled: !!serviceId,
    });
  };

  // ============================================================================
  // 4. Networking Module Hooks
  // ============================================================================

  const useNetworkDevices = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["networking", "devices", params],
      queryFn: () => ispClient.getNetworkDevices(params),
      refetchInterval: 30000, // Refresh every 30 seconds for real-time monitoring
    });
  };

  const useNetworkDevice = (id: string) => {
    return useQuery({
      queryKey: ["networking", "devices", id],
      queryFn: () => ispClient.getNetworkDevice(id),
      enabled: !!id,
      refetchInterval: 10000, // Refresh every 10 seconds for device monitoring
    });
  };

  const useIPAM = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["networking", "ipam", params],
      queryFn: () => ispClient.getIPAMData(params),
    });
  };

  const useAllocateIP = () => {
    return useMutation({
      mutationFn: (request: any) => ispClient.allocateIP(request),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["networking", "ipam"] });
      },
    });
  };

  const useNetworkTopology = () => {
    return useQuery({
      queryKey: ["networking", "topology"],
      queryFn: () => ispClient.getNetworkTopology(),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useNetworkMonitoring = () => {
    return useQuery({
      queryKey: ["networking", "monitoring"],
      queryFn: () => ispClient.getNetworkMonitoring(),
      refetchInterval: 15000, // Refresh every 15 seconds
    });
  };

  // ============================================================================
  // 5. Sales Module Hooks
  // ============================================================================

  const useLeads = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["sales", "leads", params],
      queryFn: () => ispClient.getLeads(params),
    });
  };

  const useCreateLead = () => {
    return useMutation({
      mutationFn: (leadData: any) => ispClient.createLead(leadData),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["sales", "leads"] });
      },
    });
  };

  const useCRMData = (customerId: string) => {
    return useQuery({
      queryKey: ["sales", "crm", customerId],
      queryFn: () => ispClient.getCRMData(customerId),
      enabled: !!customerId,
    });
  };

  const useCampaigns = () => {
    return useQuery({
      queryKey: ["sales", "campaigns"],
      queryFn: () => ispClient.getCampaigns(),
    });
  };

  const useSalesAnalytics = (period?: string) => {
    const params = period ? { period } : undefined;
    return useQuery({
      queryKey: ["sales", "analytics", period],
      queryFn: () => ispClient.getSalesAnalytics(params),
    });
  };

  // ============================================================================
  // 6. Support Module Hooks
  // ============================================================================

  const useSupportTickets = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["support", "tickets", params],
      queryFn: () => ispClient.getSupportTickets(params),
    });
  };

  const useSupportTicket = (id: string) => {
    return useQuery({
      queryKey: ["support", "tickets", id],
      queryFn: () => ispClient.getSupportTicket(id),
      enabled: !!id,
    });
  };

  const useCreateSupportTicket = () => {
    return useMutation({
      mutationFn: (ticketData: any) => ispClient.createSupportTicket(ticketData),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
      },
    });
  };

  const useUpdateSupportTicket = () => {
    return useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) =>
        ispClient.updateSupportTicket(id, updates),
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
        queryClient.invalidateQueries({ queryKey: ["support", "tickets", id] });
      },
    });
  };

  const useKnowledgeBase = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["support", "knowledge-base", params],
      queryFn: () => ispClient.getKnowledgeBase(params),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useSLAMetrics = () => {
    return useQuery({
      queryKey: ["support", "sla", "metrics"],
      queryFn: () => ispClient.getSLAMetrics(),
      refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });
  };

  // ============================================================================
  // 7. Resellers Module Hooks
  // ============================================================================

  const useResellers = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["resellers", params],
      queryFn: () => ispClient.getResellers(params),
    });
  };

  const useReseller = (id: string) => {
    return useQuery({
      queryKey: ["resellers", id],
      queryFn: () => ispClient.getReseller(id),
      enabled: !!id,
    });
  };

  const useResellerCommissions = (resellerId: string, period?: string) => {
    const params = { resellerId, ...(period ? { period } : {}) };
    return useQuery({
      queryKey: ["resellers", resellerId, "commissions", period],
      queryFn: () => ispClient.getResellerCommissions(params),
      enabled: !!resellerId,
    });
  };

  const useResellerPerformance = (resellerId: string) => {
    return useQuery({
      queryKey: ["resellers", resellerId, "performance"],
      queryFn: () => ispClient.getResellerPerformance({ resellerId }),
      enabled: !!resellerId,
    });
  };

  // ============================================================================
  // 8. Analytics Module Hooks
  // ============================================================================

  const useBusinessIntelligence = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["analytics", "business-intelligence", params],
      queryFn: () => ispClient.getBusinessIntelligence(params),
    });
  };

  const useDataVisualization = (type: string, params?: any) => {
    return useQuery({
      queryKey: ["analytics", "visualization", type, params],
      queryFn: () => ispClient.getDataVisualization(type, params),
      enabled: !!type,
    });
  };

  const useCustomReports = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["analytics", "reports", params],
      queryFn: () => ispClient.getCustomReports(params),
    });
  };

  const useGenerateReport = () => {
    return useMutation({
      mutationFn: (reportConfig: any) => ispClient.generateReport(reportConfig),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["analytics", "reports"] });
      },
    });
  };

  // ============================================================================
  // 9. Inventory Module Hooks
  // ============================================================================

  const useInventoryItems = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["inventory", "items", params],
      queryFn: () => ispClient.getInventoryItems(params),
    });
  };

  const useWarehouseManagement = () => {
    return useQuery({
      queryKey: ["inventory", "warehouses"],
      queryFn: () => ispClient.getWarehouseManagement(),
    });
  };

  const useProcurementOrders = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["inventory", "procurement", params],
      queryFn: () => ispClient.getProcurementOrders(params),
    });
  };

  // ============================================================================
  // 10. Field Operations Module Hooks
  // ============================================================================

  const useWorkOrders = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["field-ops", "work-orders", params],
      queryFn: () => ispClient.getWorkOrders(params),
    });
  };

  const useWorkOrder = (id: string) => {
    return useQuery({
      queryKey: ["field-ops", "work-orders", id],
      queryFn: () => ispClient.getWorkOrder(id),
      enabled: !!id,
    });
  };

  const useCreateWorkOrder = () => {
    return useMutation({
      mutationFn: (workOrderData: any) => ispClient.createWorkOrder(workOrderData),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["field-ops", "work-orders"],
        });
      },
    });
  };

  const useTechnicians = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["field-ops", "technicians", params],
      queryFn: () => ispClient.getTechnicians(params),
    });
  };

  const useTechnicianLocation = (technicianId: string) => {
    return useQuery({
      queryKey: ["field-ops", "technicians", technicianId, "location"],
      queryFn: () => ispClient.getTechnicianLocation(technicianId),
      enabled: !!technicianId,
      refetchInterval: 30000, // Refresh every 30 seconds for location tracking
    });
  };

  const useUpdateTechnicianLocation = () => {
    return useMutation({
      mutationFn: ({ technicianId, location }: { technicianId: string; location: GeoLocation }) =>
        ispClient.updateTechnicianLocation(technicianId, location),
      onSuccess: (_, { technicianId }) => {
        queryClient.invalidateQueries({
          queryKey: ["field-ops", "technicians", technicianId, "location"],
        });
      },
    });
  };

  // ============================================================================
  // 11. Compliance Module Hooks
  // ============================================================================

  const useComplianceReports = () => {
    return useQuery({
      queryKey: ["compliance", "reports"],
      queryFn: () => ispClient.getComplianceReports(),
    });
  };

  const useAuditTrail = (params?: QueryParams) => {
    return useQuery({
      queryKey: ["compliance", "audit-trail", params],
      queryFn: () => ispClient.getAuditTrail(params),
    });
  };

  const useDataProtectionStatus = () => {
    return useQuery({
      queryKey: ["compliance", "data-protection"],
      queryFn: () => ispClient.getDataProtectionStatus(),
    });
  };

  // ============================================================================
  // 12. Notifications Module Hooks
  // ============================================================================

  const useNotificationTemplates = () => {
    return useQuery({
      queryKey: ["notifications", "templates"],
      queryFn: () => ispClient.getNotificationTemplates(),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useSendEmail = () => {
    return useMutation({
      mutationFn: (emailData: any) => ispClient.sendEmail(emailData),
    });
  };

  const useSendSMS = () => {
    return useMutation({
      mutationFn: (smsData: any) => ispClient.sendSMS(smsData),
    });
  };

  const useAutomationRules = () => {
    return useQuery({
      queryKey: ["notifications", "automation", "rules"],
      queryFn: () => ispClient.getAutomationRules(),
    });
  };

  // ============================================================================
  // 13. Licensing Module Hooks
  // ============================================================================

  const useLicenseInfo = () => {
    return useQuery({
      queryKey: ["licensing", "info"],
      queryFn: () => ispClient.getLicenseInfo(),
      staleTime: 15 * 60 * 1000, // 15 minutes
    });
  };

  const useFeatureEntitlements = () => {
    return useQuery({
      queryKey: ["licensing", "features"],
      queryFn: () => ispClient.getFeatureEntitlements(),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useValidateLicense = () => {
    return useCallback(
      async (payload: Record<string, any>) => {
        return ispClient.validateLicense(payload);
      },
      [ispClient],
    );
  };

  // ============================================================================
  // Dashboard Hooks
  // ============================================================================

  const useAdminDashboard = () => {
    return useQuery({
      queryKey: ["dashboard", "admin"],
      queryFn: () => ispClient.getAdminDashboard(),
      refetchInterval: 60000, // Refresh every minute
    });
  };

  const useCustomerDashboard = () => {
    return useQuery({
      queryKey: ["dashboard", "customer"],
      queryFn: () => ispClient.getCustomerDashboard(),
      refetchInterval: 60000, // Refresh every minute
    });
  };

  const useResellerDashboard = () => {
    return useQuery({
      queryKey: ["dashboard", "reseller"],
      queryFn: () => ispClient.getResellerDashboard(),
      refetchInterval: 60000, // Refresh every minute
    });
  };

  const useTechnicianDashboard = () => {
    return useQuery({
      queryKey: ["dashboard", "technician"],
      queryFn: () => ispClient.getTechnicianDashboard(),
      refetchInterval: 60000, // Refresh every minute
    });
  };

  return {
    // Identity Module
    useUsers,
    useUser,
    useCustomers,
    useCustomer,
    useCreateCustomer,

    // Billing Module
    useInvoices,
    useInvoice,
    usePayments,
    useProcessPayment,
    useSubscriptions,

    // Services Module
    useServiceCatalog,
    useServiceInstances,
    useProvisionService,
    useUsageTracking,

    // Networking Module
    useNetworkDevices,
    useNetworkDevice,
    useIPAM,
    useAllocateIP,
    useNetworkTopology,
    useNetworkMonitoring,

    // Sales Module
    useLeads,
    useCreateLead,
    useCRMData,
    useCampaigns,
    useSalesAnalytics,

    // Support Module
    useSupportTickets,
    useSupportTicket,
    useCreateSupportTicket,
    useUpdateSupportTicket,
    useKnowledgeBase,
    useSLAMetrics,

    // Resellers Module
    useResellers,
    useReseller,
    useResellerCommissions,
    useResellerPerformance,

    // Analytics Module
    useBusinessIntelligence,
    useDataVisualization,
    useCustomReports,
    useGenerateReport,

    // Inventory Module
    useInventoryItems,
    useWarehouseManagement,
    useProcurementOrders,

    // Field Operations Module
    useWorkOrders,
    useWorkOrder,
    useCreateWorkOrder,
    useTechnicians,
    useTechnicianLocation,
    useUpdateTechnicianLocation,

    // Compliance Module
    useComplianceReports,
    useAuditTrail,
    useDataProtectionStatus,

    // Notifications Module
    useNotificationTemplates,
    useSendEmail,
    useSendSMS,
    useAutomationRules,

    // Licensing Module
    useLicenseInfo,
    useFeatureEntitlements,
    useValidateLicense,

    // Dashboard Hooks
    useAdminDashboard,
    useCustomerDashboard,
    useResellerDashboard,
    useTechnicianDashboard,
  };
}
