/**
 * Network Monitoring Dashboard
 *
 * Wrapper that connects the shared NetworkMonitoringDashboard to app-specific API client and logger.
 */

"use client";

import { NetworkMonitoringDashboard as SharedNetworkMonitoringDashboard } from "@dotmac/features/monitoring";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/utils/logger";

export function NetworkMonitoringDashboard() {
  return <SharedNetworkMonitoringDashboard apiClient={apiClient} logger={logger} />;
}
