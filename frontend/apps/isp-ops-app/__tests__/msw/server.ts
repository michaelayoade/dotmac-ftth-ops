/**
 * MSW Server Setup for Tests
 *
 * This sets up a Mock Service Worker server that intercepts network requests
 * during tests, providing realistic API mocking without manually mocking fetch.
 */

import { setupServer } from 'msw/node';
import { webhookHandlers } from './handlers/webhooks';
import { notificationHandlers } from './handlers/notifications';
import { billingPlansHandlers } from './handlers/billing-plans';
import { dunningHandlers } from './handlers/dunning';
import { creditNotesHandlers } from './handlers/credit-notes';
import { invoiceActionsHandlers } from './handlers/invoice-actions';
import { networkMonitoringHandlers } from './handlers/network-monitoring';
import { networkInventoryHandlers } from './handlers/network-inventory';
import { radiusHandlers } from './handlers/radius';
import { subscriberHandlers } from './handlers/subscribers';
import { faultHandlers } from './handlers/faults';
import { userHandlers } from './handlers/users';
import { apiKeysHandlers } from './handlers/apiKeys';
import { integrationsHandlers } from './handlers/integrations';
import { healthHandlers } from './handlers/health';
import { featureFlagsHandlers } from './handlers/featureFlags';
import { operationsHandlers } from './handlers/operations';
import { jobsHandlers } from './handlers/jobs';
import { schedulerHandlers } from './handlers/scheduler';
import { orchestrationHandlers } from './handlers/orchestration';
import { serviceLifecycleHandlers } from './handlers/service-lifecycle';
import { logsHandlers } from './handlers/logs';
import { techniciansHandlers } from './handlers/technicians';
import { auditHandlers } from './handlers/audit';
import { fieldServiceHandlers } from './handlers/field-service';
import { reconciliationHandlers } from './handlers/reconciliation';
import { commissionRulesHandlers } from './handlers/commission-rules';

// Combine all handlers
// NOTE: logsHandlers MUST come before operationsHandlers to prevent
// operations from matching /api/v1/monitoring/logs/stats first
// NOTE: More specific URL patterns must come before broader patterns to prevent
// conflicts. For example:
// - logsHandlers must come before operationsHandlers
// - fieldServiceHandlers must come before techniciansHandlers (to match /api/v1/field-service/* before */field-service/*)
export const handlers = [
  ...logsHandlers, // Must be first to match /api/v1/monitoring/logs/stats correctly
  ...fieldServiceHandlers, // Must come before techniciansHandlers to match /api/v1/field-service/* correctly
  ...webhookHandlers,
  ...notificationHandlers,
  ...billingPlansHandlers,
  ...dunningHandlers,
  ...reconciliationHandlers,
  ...commissionRulesHandlers,
  ...creditNotesHandlers,
  ...invoiceActionsHandlers,
  ...networkMonitoringHandlers,
  ...networkInventoryHandlers,
  ...radiusHandlers,
  ...subscriberHandlers,
  ...faultHandlers,
  ...userHandlers,
  ...apiKeysHandlers,
  ...integrationsHandlers,
  ...healthHandlers,
  ...featureFlagsHandlers,
  ...operationsHandlers,
  ...jobsHandlers,
  ...schedulerHandlers,
  ...orchestrationHandlers,
  ...serviceLifecycleHandlers,
  ...techniciansHandlers,
  ...auditHandlers,
];

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
