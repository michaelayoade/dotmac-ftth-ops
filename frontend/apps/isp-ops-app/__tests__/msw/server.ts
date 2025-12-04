/**
 * MSW Server Setup for Tests
 *
 * This sets up a Mock Service Worker server that intercepts network requests
 * during tests, providing realistic API mocking without manually mocking fetch.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";
import { webhookHandlers } from "./handlers/webhooks";
import { notificationHandlers } from "./handlers/notifications";
import { billingPlansHandlers } from "./handlers/billing-plans";
import { dunningHandlers } from "./handlers/dunning";
import { creditNotesHandlers } from "./handlers/credit-notes";
import { invoiceActionsHandlers } from "./handlers/invoice-actions";
import { networkMonitoringHandlers } from "./handlers/network-monitoring";
import { networkInventoryHandlers } from "./handlers/network-inventory";
import { radiusHandlers } from "./handlers/radius";
import { subscriberHandlers } from "./handlers/subscribers";
import { faultHandlers } from "./handlers/faults";
import { userHandlers } from "./handlers/users";
import { apiKeysHandlers } from "./handlers/apiKeys";
import { integrationsHandlers } from "./handlers/integrations";
import { healthHandlers } from "./handlers/health";
import { featureFlagsHandlers } from "./handlers/featureFlags";
import { operationsHandlers } from "./handlers/operations";
import { jobsHandlers } from "./handlers/jobs";
import { schedulerHandlers } from "./handlers/scheduler";
import { orchestrationHandlers } from "./handlers/orchestration";
import { serviceLifecycleHandlers } from "./handlers/service-lifecycle";
import { logsHandlers } from "./handlers/logs";
import { techniciansHandlers } from "./handlers/technicians";
import { auditHandlers } from "./handlers/audit";
import { fieldServiceHandlers } from "./handlers/field-service";
import { reconciliationHandlers } from "./handlers/reconciliation";
import { commissionRulesHandlers } from "./handlers/commission-rules";
import { partnersHandlers } from "./handlers/partners";
import { platformTenantsHandlers } from "./handlers/platform-tenants";
import { brandingHandlers } from "./handlers/branding";
import { domainVerificationHandlers } from "./handlers/domain-verification";
import { aiChatHandlers } from "./handlers/ai-chat";
import { tenantOnboardingHandlers } from "./handlers/tenant-onboarding";
import { partnerPortalHandlers } from "./handlers/partner-portal";
import { customerPortalHandlers } from "./handlers/customer-portal";
import { searchHandlers } from "./handlers/search";
import { profileHandlers } from "./handlers/profile";
import { settingsHandlers } from "./handlers/settings";
import { licensingHandlers } from "./handlers/licensing";
import { versioningHandlers } from "./handlers/versioning";
import { dataTransferHandlers } from "./handlers/data-transfer";
import { pluginsHandlers } from "./handlers/plugins";
import { communicationsHandlers } from "./handlers/communications";
import { graphqlHandlers } from "./handlers/graphql";
import { graphqlFiberHandlers } from "./handlers/graphql-fiber";
import { graphqlSubscriberHandlers } from "./handlers/graphql-subscriber";
import { wirelessGraphQLHandlers } from "./handlers/graphql-wireless";

interface HandlerGroup {
  id: string;
  handlers: RequestHandler[];
}

// Handler registration is order-dependent. Keep this list synchronized with ./handlers directory.
const handlerGroups: HandlerGroup[] = [
  // Must be first to match /api/v1/monitoring/logs/stats correctly
  { id: "logs", handlers: logsHandlers },
  // Communications must precede notifications and operations to ensure /communications routes use the dedicated handlers
  { id: "communications", handlers: communicationsHandlers },
  // Must come before techniciansHandlers to match /api/v1/field-service/* correctly
  { id: "field-service", handlers: fieldServiceHandlers },
  // Must come before userHandlers to match /api/v1/platform-admin/tenants/:id/users before */users
  { id: "platform-tenants", handlers: platformTenantsHandlers },
  { id: "webhooks", handlers: webhookHandlers },
  { id: "notifications", handlers: notificationHandlers },
  { id: "billing-plans", handlers: billingPlansHandlers },
  { id: "dunning", handlers: dunningHandlers },
  { id: "reconciliation", handlers: reconciliationHandlers },
  { id: "commission-rules", handlers: commissionRulesHandlers },
  { id: "partners", handlers: partnersHandlers },
  { id: "credit-notes", handlers: creditNotesHandlers },
  { id: "invoice-actions", handlers: invoiceActionsHandlers },
  { id: "network-monitoring", handlers: networkMonitoringHandlers },
  { id: "network-inventory", handlers: networkInventoryHandlers },
  { id: "radius", handlers: radiusHandlers },
  { id: "subscribers", handlers: subscriberHandlers },
  { id: "faults", handlers: faultHandlers },
  { id: "users", handlers: userHandlers },
  { id: "apiKeys", handlers: apiKeysHandlers },
  { id: "integrations", handlers: integrationsHandlers },
  { id: "health", handlers: healthHandlers },
  { id: "featureFlags", handlers: featureFlagsHandlers },
  // Must come before operationsHandlers to match /versions/:version/health before */health
  { id: "versioning", handlers: versioningHandlers },
  // Must come before operationsHandlers to match /api/v1/plugins/instances/:instanceId/health before */health
  { id: "plugins", handlers: pluginsHandlers },
  { id: "operations", handlers: operationsHandlers },
  { id: "jobs", handlers: jobsHandlers },
  { id: "scheduler", handlers: schedulerHandlers },
  { id: "orchestration", handlers: orchestrationHandlers },
  { id: "service-lifecycle", handlers: serviceLifecycleHandlers },
  { id: "technicians", handlers: techniciansHandlers },
  { id: "audit", handlers: auditHandlers },
  { id: "branding", handlers: brandingHandlers },
  { id: "domain-verification", handlers: domainVerificationHandlers },
  { id: "ai-chat", handlers: aiChatHandlers },
  { id: "tenant-onboarding", handlers: tenantOnboardingHandlers },
  { id: "partner-portal", handlers: partnerPortalHandlers },
  { id: "customer-portal", handlers: customerPortalHandlers },
  { id: "search", handlers: searchHandlers },
  { id: "profile", handlers: profileHandlers },
  { id: "settings", handlers: settingsHandlers },
  { id: "licensing", handlers: licensingHandlers },
  { id: "data-transfer", handlers: dataTransferHandlers },
  // GraphQL handlers - specific handlers MUST come before general handlers to override
  { id: "graphql-subscriber", handlers: graphqlSubscriberHandlers },
  { id: "graphql-fiber", handlers: graphqlFiberHandlers },
  { id: "graphql-wireless", handlers: wirelessGraphQLHandlers },
  { id: "graphql", handlers: graphqlHandlers },
];

export const handlers = handlerGroups.flatMap((group) => group.handlers);

if (shouldValidateHandlers()) {
  validateHandlerRegistration(handlerGroups);
}

// Create MSW server
export const server = setupServer(...handlers);

// Helper to reset handlers between tests
export function resetServerHandlers() {
  server.resetHandlers();
}

// Helper to add runtime handlers for specific tests
export function addRuntimeHandler(...newHandlers: any[]) {
  server.use(...newHandlers);
}

function shouldValidateHandlers() {
  return process.env.MSW_SKIP_HANDLER_VALIDATION !== "true";
}

function validateHandlerRegistration(groups: HandlerGroup[]) {
  try {
    const handlersDir = path.resolve(__dirname, "handlers");
    const discovered = readdirSync(handlersDir)
      .filter((file) => /\.(ts|tsx|js|cjs|mjs)$/.test(file))
      .map((file) => file.replace(/\.(ts|tsx|js|cjs|mjs)$/, ""));
    const registered = new Set(groups.map((group) => group.id));

    const missing = discovered.filter((name) => !registered.has(name));
    if (missing.length > 0) {
      throw new Error(`[MSW] Missing handler registrations in server.ts: ${missing.join(", ")}`);
    }

    const obsolete = groups.map((group) => group.id).filter((name) => !discovered.includes(name));
    if (obsolete.length > 0) {
      console.warn(
        `[MSW] Handler registrations without source files detected: ${obsolete.join(", ")}`,
      );
    }
  } catch (error) {
    console.error(
      `[MSW] Handler registration validation failed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    throw error;
  }
}
