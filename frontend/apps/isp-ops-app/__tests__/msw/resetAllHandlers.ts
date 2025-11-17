/**
 * Centralized reset function for all MSW handler storage
 * This file imports and calls all reset/clear functions to prevent state pollution between tests
 */

import { clearAIChatData } from "./handlers/ai-chat";
import { resetApiKeysStorage } from "./handlers/apiKeys";
import { clearAuditData } from "./handlers/audit";
import { resetBillingPlansStorage } from "./handlers/billing-plans";
import { clearBrandingData } from "./handlers/branding";
import { clearCommissionRulesData } from "./handlers/commission-rules";
import { clearCommunicationsData } from "./handlers/communications";
import { resetCreditNotesStorage } from "./handlers/credit-notes";
import { clearCustomerPortalData } from "./handlers/customer-portal";
import { clearDataTransferData } from "./handlers/data-transfer";
import { clearDomainStatuses } from "./handlers/domain-verification";
import { resetDunningStorage } from "./handlers/dunning";
import { resetFaultStorage } from "./handlers/faults";
import { resetFeatureFlagsStorage } from "./handlers/featureFlags";
import { clearFieldServiceData } from "./handlers/field-service";
import { resetFiberData } from "./handlers/graphql-fiber";
import { clearGraphQLSubscriberData } from "./handlers/graphql-subscriber";
import { clearWirelessData } from "./handlers/graphql-wireless";
import { clearAllGraphQLData } from "./handlers/graphql";
import { resetHealthStorage } from "./handlers/health";
import { resetIntegrationsStorage } from "./handlers/integrations";
import { resetInvoiceActionsStorage } from "./handlers/invoice-actions";
import { resetJobsStorage } from "./handlers/jobs";
import { clearLicensingData } from "./handlers/licensing";
import { resetLogsStorage } from "./handlers/logs";
import { resetNetworkInventoryStorage } from "./handlers/network-inventory";
import { resetNetworkMonitoringStorage } from "./handlers/network-monitoring";
import { resetNotificationStorage } from "./handlers/notifications";
import { resetOperationsStorage } from "./handlers/operations";
import { resetOrchestrationStorage } from "./handlers/orchestration";
import { clearPartnerPortalData } from "./handlers/partner-portal";
import { clearPartnersData } from "./handlers/partners";
import { clearPlatformTenantsData } from "./handlers/platform-tenants";
import { clearPluginData } from "./handlers/plugins";
import { resetProfileData } from "./handlers/profile";
import { resetRADIUSStorage } from "./handlers/radius";
import { clearReconciliationData } from "./handlers/reconciliation";
import { resetSchedulerStorage } from "./handlers/scheduler";
import { resetSearchData } from "./handlers/search";
import { resetServiceLifecycleStorage } from "./handlers/service-lifecycle";
import { clearSettingsData } from "./handlers/settings";
import { resetSubscriberStorage } from "./handlers/subscribers";
import { resetTechniciansStorage } from "./handlers/technicians";
import { clearTenantOnboardingData } from "./handlers/tenant-onboarding";
import { resetUserStorage } from "./handlers/users";
import { clearVersioningData } from "./handlers/versioning";
import { resetWebhookStorage } from "./handlers/webhooks";

/**
 * Reset all MSW handler storage
 * Call this in afterEach to prevent state pollution between tests
 */
export function resetAllMSWHandlerStorage() {
  clearAIChatData();
  resetApiKeysStorage();
  clearAuditData();
  resetBillingPlansStorage();
  clearBrandingData();
  clearCommissionRulesData();
  clearCommunicationsData();
  resetCreditNotesStorage();
  clearCustomerPortalData();
  clearDataTransferData();
  clearDomainStatuses();
  resetDunningStorage();
  resetFaultStorage();
  resetFeatureFlagsStorage();
  clearFieldServiceData();
  resetFiberData();
  clearGraphQLSubscriberData();
  clearWirelessData();
  clearAllGraphQLData();
  resetHealthStorage();
  resetIntegrationsStorage();
  resetInvoiceActionsStorage();
  resetJobsStorage();
  clearLicensingData();
  resetLogsStorage();
  resetNetworkInventoryStorage();
  resetNetworkMonitoringStorage();
  resetNotificationStorage();
  resetOperationsStorage();
  resetOrchestrationStorage();
  clearPartnerPortalData();
  clearPartnersData();
  clearPlatformTenantsData();
  clearPluginData();
  resetProfileData();
  resetRADIUSStorage();
  clearReconciliationData();
  resetSchedulerStorage();
  resetSearchData();
  resetServiceLifecycleStorage();
  clearSettingsData();
  resetSubscriberStorage();
  resetTechniciansStorage();
  clearTenantOnboardingData();
  resetUserStorage();
  clearVersioningData();
  resetWebhookStorage();
}
