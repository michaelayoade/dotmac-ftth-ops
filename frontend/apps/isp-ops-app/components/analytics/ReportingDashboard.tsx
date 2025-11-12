/**
 * ReportingDashboard Component
 *
 * Wrapper that connects the shared ReportingDashboard to app-specific dependencies.
 */

"use client";

import { ReportingDashboard as SharedReportingDashboard } from "@dotmac/features/analytics";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

export function ReportingDashboard() {
  return <SharedReportingDashboard apiClient={apiClient} useToast={useToast} />;
}
